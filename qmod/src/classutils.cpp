#include "classutils.hpp"

#include "System/Enum.hpp"
#include "System/RuntimeType.hpp"
#include "main.hpp"
#include "members.hpp"

using namespace ClassUtils;
using namespace il2cpp_utils;

static std::unordered_map<Il2CppType const*, ProtoTypeInfo> typeInfoCache;

// basically copied from il2cpp (field setting). what could go wrong?
// (so blame them for the gotos)
size_t fieldTypeSize(Il2CppType const* type) {
    int t;
    if (type->byref)
        return sizeof(void*);
    t = type->type;
handle_enum:
    switch (t) {
        case IL2CPP_TYPE_BOOLEAN:
        case IL2CPP_TYPE_I1:
        case IL2CPP_TYPE_U1:
            return sizeof(uint8_t);
        case IL2CPP_TYPE_I2:
        case IL2CPP_TYPE_U2:
            return sizeof(uint16_t);
        case IL2CPP_TYPE_CHAR:
            return sizeof(Il2CppChar);
        case IL2CPP_TYPE_I4:
        case IL2CPP_TYPE_U4:
            return sizeof(int32_t);
        case IL2CPP_TYPE_I:
        case IL2CPP_TYPE_U:
        case IL2CPP_TYPE_I8:
        case IL2CPP_TYPE_U8:
            return sizeof(int64_t);
        case IL2CPP_TYPE_R4:
            return sizeof(float);
        case IL2CPP_TYPE_R8:
            return sizeof(double);
        case IL2CPP_TYPE_STRING:  // note that this is overridden sometimes but should still return the size of an Il2CppString*
        case IL2CPP_TYPE_SZARRAY:
        case IL2CPP_TYPE_CLASS:
        case IL2CPP_TYPE_OBJECT:
        case IL2CPP_TYPE_ARRAY:
        case IL2CPP_TYPE_FNPTR:
        case IL2CPP_TYPE_PTR:
            return 8;
        case IL2CPP_TYPE_VALUETYPE:
            // their comment: /* note that 't' and 'type->type' can be different */
            if (type->type == IL2CPP_TYPE_VALUETYPE && il2cpp_functions::class_from_il2cpp_type(type)->enumtype) {
                t = il2cpp_functions::class_from_il2cpp_type(type)->element_class->byval_arg.type;
                goto handle_enum;
            } else {
                auto clazz = il2cpp_functions::class_from_il2cpp_type(type);
                return il2cpp_functions::class_instance_size(clazz) - sizeof(Il2CppObject);
            }
        case IL2CPP_TYPE_GENERICINST:
            // t =
            // GenericClass::GetTypeDefinition(type->data.generic_class)->byval_arg.type;
#ifdef UNITY_2021
            t = il2cpp_functions::MetadataCache_GetTypeInfoFromHandle(type->data.generic_class->type->data.typeHandle)->byval_arg.type;
#else
            t = il2cpp_functions::MetadataCache_GetTypeInfoFromTypeDefinitionIndex(type->data.generic_class->typeDefinitionIndex)->byval_arg.type;
#endif
            goto handle_enum;
        case IL2CPP_TYPE_VOID:
            // added myself but I mean it makes sense, probably doesn't actually matter for functionality though
            return 0;
        default:
            LOG_ERROR("Error: unknown type size");
            return 8;
    }
}

// field_get_value, field_set_value
std::vector<FieldInfo const*> ClassUtils::GetFields(Il2CppClass const* clazz) {
    if (!clazz->fields)
        return {};

    std::vector<FieldInfo const*> ret;
    ret.reserve(clazz->field_count);

    for (auto const& field : std::span(clazz->fields, clazz->field_count))
        ret.emplace_back(&field);
    return ret;
}

std::pair<MethodInfo const*, MethodInfo const*> ClassUtils::GetPropMethods(PropertyInfo const* prop) {
    std::pair<MethodInfo const*, MethodInfo const*> ret;

    if (auto m = il2cpp_functions::property_get_get_method(prop))
        ret.first = m;
    if (auto m = il2cpp_functions::property_get_set_method(prop))
        ret.second = m;
    return ret;
}

std::vector<PropertyInfo const*> ClassUtils::GetProperties(Il2CppClass const* clazz) {
    if (!clazz->properties)
        return {};

    std::vector<PropertyInfo const*> ret;
    ret.reserve(clazz->property_count);

    for (auto const& property : std::span(clazz->properties, clazz->property_count)) {
        bool normal = !property.get || property.get->parameters_count == 0;
        normal = normal && (!property.set || property.set->parameters_count == 1);
        if (normal)
            ret.emplace_back(&property);
    }
    return ret;
}

std::vector<MethodInfo const*> ClassUtils::GetMethods(Il2CppClass const* clazz) {
    if (!clazz->methods)
        return {};

    std::vector<MethodInfo const*> ret;
    ret.reserve(clazz->method_count);

    for (auto const& method : std::span(clazz->methods, clazz->method_count)) {
        if (method)
            ret.emplace_back(method);
    }
    return ret;
}

std::vector<Il2CppClass const*> ClassUtils::GetInterfaces(Il2CppClass const* clazz) {
    if (!clazz->implementedInterfaces)
        return {};

    std::vector<Il2CppClass const*> ret;
    ret.reserve(clazz->interfaces_count);

    for (auto const& interface : std::span(clazz->implementedInterfaces, clazz->interfaces_count)) {
        if (interface)
            ret.push_back(interface);
    }
    return ret;
}

Il2CppClass const* ClassUtils::GetParent(Il2CppClass const* clazz) {
    return clazz->parent;
}

bool ClassUtils::GetIsLiteral(FieldInfo const* field) {
    return (field->type->attrs & FIELD_ATTRIBUTE_LITERAL) != 0;
}

bool ClassUtils::GetIsStatic(FieldInfo const* field) {
    return (field->type->attrs & FIELD_ATTRIBUTE_STATIC) != 0;
}

bool ClassUtils::GetIsStatic(PropertyInfo const* prop) {
    if (prop->get)
        return (prop->get->flags & METHOD_ATTRIBUTE_STATIC) != 0;
    if (prop->set)
        return (prop->set->flags & METHOD_ATTRIBUTE_STATIC) != 0;
    return false;
}

bool ClassUtils::GetIsStatic(MethodInfo const* method) {
    return (method->flags & METHOD_ATTRIBUTE_STATIC) != 0;
}

#ifdef UNITY_2021
// from custom-types
// checks whether the ty->data could be a pointer. technically could be UB if the address is low enough
static bool MetadataHandleSet(Il2CppType const* type) {
    return ((uint64_t) type->data.typeHandle >> 32);
}

bool ClassUtils::GetIsCustom(Il2CppType const* type) {
    if (MetadataHandleSet(type))
        return false;
    return type->data.__klassIndex <= kTypeDefinitionIndexInvalid;
}
#else
bool ClassUtils::GetIsCustom(Il2CppType const* type) {
    // shouldn't be needed anywhere on old unity
    return false;
}
#endif

// from here, use type instead of class, as it is slightly more specific in cases such as byrefs

ProtoTypeInfo ClassUtils::GetTypeInfo(Il2CppType const* type, bool param) {
    LOG_DEBUG("Getting type info {} (param: {})", il2cpp_functions::type_get_name(type), param);
    LOG_DEBUG("Type enum {}", (int) type->type);

    auto cached = typeInfoCache.find(type);
    if (cached != typeInfoCache.end()) {
        LOG_DEBUG("Returning cached type info");
        return cached->second;
    }

    ProtoTypeInfo info;
    info.set_size(fieldTypeSize(type));
    LOG_DEBUG("Found size {}", info.size());

    if (type->type == IL2CPP_TYPE_CLASS) {
        if (classoftype(type) == il2cpp_functions::defaults->systemtype_class)
            info.set_primitiveinfo(ProtoTypeInfo::TYPE);
        else
            *info.mutable_classinfo() = GetClassInfo(type);
    } else if (type->type == IL2CPP_TYPE_SZARRAY)  // szarray means regular array, array means some fancy multidimensional never used c# thing I think
        *info.mutable_arrayinfo() = GetArrayInfo(type);
    else if (type->type == IL2CPP_TYPE_VAR || type->type == IL2CPP_TYPE_MVAR)
        *info.mutable_genericinfo() = GetGenericInfo(type);
    else if (classoftype(type)->enumtype)  // check BEFORE value type - enums are that! (idk what IL2CPP_TYPE_ENUM is for)
        *info.mutable_enuminfo() = GetEnumInfo(type);
    else if (type->type == IL2CPP_TYPE_VALUETYPE || type->type == IL2CPP_TYPE_GENERICINST)  // genericinst is instance of a generic struct I think
        *info.mutable_structinfo() = GetStructInfo(type);
    else if (auto primitive = GetPrimitive(type); primitive >= 0)
        info.set_primitiveinfo(primitive);
    else
        LOG_ERROR("Unknown type {}!", (int) type->type);
    if (type->byref) {
        if (param && type->attrs & PARAM_ATTRIBUTE_IN)
            info.set_byref_(ProtoTypeInfo_Byref_IN);
        else if (param && type->attrs & PARAM_ATTRIBUTE_OUT)
            info.set_byref_(ProtoTypeInfo_Byref_OUT);
        else
            info.set_byref_(ProtoTypeInfo_Byref_REF);
    } else
        info.set_byref_(ProtoTypeInfo_Byref_NONE);

    typeInfoCache[type] = info;

    return info;
}

ProtoTypeInfo::Primitive ClassUtils::GetPrimitive(Il2CppType const* primitiveType) {
    switch (primitiveType->type) {
        case IL2CPP_TYPE_BOOLEAN:
            return ProtoTypeInfo::BOOLEAN;
        case IL2CPP_TYPE_CHAR:
            return ProtoTypeInfo::CHAR;
        case IL2CPP_TYPE_I1:
        case IL2CPP_TYPE_U1:
            return ProtoTypeInfo::BYTE;
        case IL2CPP_TYPE_I2:
        case IL2CPP_TYPE_U2:
            return ProtoTypeInfo::SHORT;
        case IL2CPP_TYPE_I4:
        case IL2CPP_TYPE_U4:
            return ProtoTypeInfo::INT;
        case IL2CPP_TYPE_I:
        case IL2CPP_TYPE_U:
        case IL2CPP_TYPE_I8:
        case IL2CPP_TYPE_U8:
            return ProtoTypeInfo::LONG;
        case IL2CPP_TYPE_R4:
            return ProtoTypeInfo::FLOAT;
        case IL2CPP_TYPE_R8:
            return ProtoTypeInfo::DOUBLE;
        case IL2CPP_TYPE_STRING:
            return ProtoTypeInfo::STRING;
        case IL2CPP_TYPE_VOID:
            return ProtoTypeInfo::VOID;
        case IL2CPP_TYPE_PTR:
            return ProtoTypeInfo::PTR;
        default:
            LOG_ERROR("Invalid primitive {}", (int) primitiveType->type);
            return (ProtoTypeInfo::Primitive) -1;
            break;
    }
}

ProtoClassInfo ClassUtils::GetClassInfo(Il2CppType const* type) {
    ProtoClassInfo classInfo;
    LOG_DEBUG("Getting class info");
    auto clazz = classoftype(type);

    auto declaring = clazz->declaringType;

    auto namespaze = clazz->namespaze;
    std::string name = clazz->name;

    while (declaring) {
        namespaze = declaring->namespaze;
        name = declaring->name + ("/" + name);
        declaring = declaring->declaringType;
    }

    classInfo.set_namespaze(namespaze);
    classInfo.set_clazz(name);

    if (type->type == IL2CPP_TYPE_GENERICINST) {
        auto genericInst = type->data.generic_class->context.class_inst;
        for (int i = 0; i < genericInst->type_argc; i++)
            *classInfo.add_generics() = GetTypeInfo(genericInst->type_argv[i]);
    }

    return classInfo;
}

ProtoArrayInfo ClassUtils::GetArrayInfo(Il2CppType const* type) {
    ProtoArrayInfo arrayInfo;
    LOG_DEBUG("Getting array info");

    *arrayInfo.mutable_membertype() = GetTypeInfo(type->data.type);
    return arrayInfo;
}

ProtoStructInfo ClassUtils::GetStructInfo(Il2CppType const* type) {
    ProtoStructInfo structInfo;
    LOG_DEBUG("Getting struct info");

    *structInfo.mutable_clazz() = GetClassInfo(type);
    for (auto const& field : GetFields(classoftype(type))) {
        if (GetIsStatic(field))
            continue;
        LOG_DEBUG("Field {} ({}) at offset {}", field->name, il2cpp_functions::type_get_name(field->type), field->offset - sizeof(Il2CppObject));
        structInfo.mutable_fieldoffsets()->insert({(int) (field->offset - sizeof(Il2CppObject)), FieldUtils::GetFieldInfo(field)});
    }
    LOG_DEBUG("Got struct info");
    return structInfo;
}

ProtoGenericInfo ClassUtils::GetGenericInfo(Il2CppType const* type) {
    ProtoGenericInfo genericInfo;
    LOG_DEBUG("Getting generic info");

#ifdef UNITY_2021
    auto genericHandle = type->data.genericParameterHandle;
    auto name = il2cpp_functions::Type_GetName(type, Il2CppTypeNameFormat::IL2CPP_TYPE_NAME_FORMAT_FULL_NAME);
#else
    auto genericHandle = type->data.genericParameterIndex;
    auto parameter = il2cpp_functions::MetadataCache_GetGenericParameterFromIndex(genericHandle);
    auto name = il2cpp_functions::MetadataCache_GetStringFromIndex(parameter->nameIndex);
#endif

    genericInfo.set_generichandle((uint64_t) genericHandle);
    genericInfo.set_name(name);
    return genericInfo;
}

ProtoEnumInfo ClassUtils::GetEnumInfo(Il2CppType const* type) {
    ProtoEnumInfo enumInfo;
    LOG_DEBUG("Getting enum info");

    *enumInfo.mutable_clazz() = GetClassInfo(type);
    auto elementClass = classoftype(type)->element_class;
    enumInfo.set_valuetype(GetPrimitive(typeofclass(elementClass)));

    auto& values = *enumInfo.mutable_values();

    static auto method = il2cpp_utils::FindMethodUnsafe("System", "Enum", "GetCachedValuesAndNames", 2);
    auto contents = il2cpp_utils::RunMethodRethrow<System::Enum::ValuesAndNames*>(nullptr, method, il2cpp_utils::GetSystemType(type), true);
    for (int i = 0; i < contents->Names.size(); i++)
        values[(std::string) contents->Names[i]] = contents->Values[i];

    LOG_DEBUG("Got enum info");
    return enumInfo;
}

static Il2CppClass* GetClass(ProtoTypeInfo::Primitive primitiveInfo) {
    LOG_DEBUG("Getting class from primitive info");

    switch (primitiveInfo) {
        case ProtoTypeInfo::BOOLEAN:
            return il2cpp_functions::defaults->boolean_class;
        case ProtoTypeInfo::CHAR:
            return il2cpp_functions::defaults->char_class;
        case ProtoTypeInfo::BYTE:
            return il2cpp_functions::defaults->byte_class;
        case ProtoTypeInfo::SHORT:
            return il2cpp_functions::defaults->int16_class;
        case ProtoTypeInfo::INT:
            return il2cpp_functions::defaults->int32_class;
        case ProtoTypeInfo::LONG:
            return il2cpp_functions::defaults->int64_class;
        case ProtoTypeInfo::FLOAT:
            return il2cpp_functions::defaults->single_class;
        case ProtoTypeInfo::DOUBLE:
            return il2cpp_functions::defaults->double_class;
        case ProtoTypeInfo::STRING:
            return il2cpp_functions::defaults->string_class;
        case ProtoTypeInfo::TYPE:
            return il2cpp_functions::defaults->systemtype_class;
        case ProtoTypeInfo::PTR:
#ifdef UNITY_2021
            // TODO: Is this right?
            return il2cpp_functions::defaults->void_class;
#else
            return il2cpp_functions::defaults->pointer_class;
#endif
        case ProtoTypeInfo::VOID:
            return il2cpp_functions::defaults->void_class;
        case ProtoTypeInfo::UNKNOWN:
        default:
            return nullptr;
    }
}

static Il2CppClass* GetClass(ProtoArrayInfo const& arrayInfo) {
    LOG_DEBUG("Getting class from array info");
    auto memberClass = GetClass(arrayInfo.membertype());
    if (!memberClass)
        return nullptr;
    return il2cpp_functions::bounded_array_class_get(memberClass, 1, false);  // szarray
}

static Il2CppClass* GetClass(ProtoStructInfo const& structInfo) {
    LOG_DEBUG("Getting class from struct info");
    return GetClass(structInfo.clazz());
}

static Il2CppClass* GetClass(ProtoGenericInfo const& genericInfo) {
    LOG_DEBUG("Getting class from generic info");
    // I don't think this should even come up
    Il2CppType type = {};
#ifdef UNITY_2021
    type.data.genericParameterHandle = (Il2CppMetadataGenericParameterHandle) genericInfo.generichandle();
#else
    type.data.genericParameterIndex = (int32_t) genericInfo.generichandle();
#endif
    type.type = IL2CPP_TYPE_VAR;  // hmm, mvar?
    return classoftype(&type);  // only uses the above two fields for var/mvar
}

static Il2CppClass* GetClass(ProtoEnumInfo const& enumInfo) {
    LOG_DEBUG("Getting class from enum info");
    return GetClass(enumInfo.clazz());
}

Il2CppClass* ClassUtils::GetClass(ProtoClassInfo const& classInfo) {
    LOG_DEBUG("Getting class from class info {}::{}", classInfo.namespaze(), classInfo.clazz());

    auto clazz = il2cpp_utils::GetClassFromName(classInfo.namespaze(), classInfo.clazz());
    if (!clazz || classInfo.generics_size() <= 0)
        return clazz;
    // no MakeGenericMethod for classes in bshook
    auto runtimeClass = il2cpp_utils::GetSystemType(clazz);
    ArrayW<System::Type*> genericArgs(classInfo.generics_size());
    for (int i = 0; i < genericArgs.size(); i++) {
        auto genericType = GetClass(classInfo.generics(i));
        if (!genericType)
            return nullptr;
        genericArgs[i] = (System::Type*) il2cpp_utils::GetSystemType(genericType);
    }

    auto inflated = System::RuntimeType::MakeGenericType((System::Type*) runtimeClass, genericArgs);
    return il2cpp_functions::class_from_system_type((Il2CppReflectionType*) inflated);
}

Il2CppClass* ClassUtils::GetClass(ProtoTypeInfo const& typeInfo) {
    switch (typeInfo.Info_case()) {
        case ProtoTypeInfo::kPrimitiveInfo:
            return GetClass(typeInfo.primitiveinfo());
        case ProtoTypeInfo::kClassInfo:
            return GetClass(typeInfo.classinfo());
        case ProtoTypeInfo::kArrayInfo:
            return GetClass(typeInfo.arrayinfo());
        case ProtoTypeInfo::kStructInfo:
            return GetClass(typeInfo.structinfo());
        case ProtoTypeInfo::kGenericInfo:
            return GetClass(typeInfo.genericinfo());
        case ProtoTypeInfo::kEnumInfo:
            return GetClass(typeInfo.enuminfo());
        default:
            LOG_ERROR("Invalid typeInfo case {}", (int) typeInfo.Info_case());
            return nullptr;
    }
}

Il2CppType* ClassUtils::GetType(ProtoTypeInfo const& typeInfo) {
    auto clazz = GetClass(typeInfo);
    if (!clazz)
        return nullptr;
    // this probably handles byref
    if (typeInfo.byref_() != ProtoTypeInfo_Byref_NONE)
        return &clazz->this_arg;
    return &clazz->byval_arg;
}

struct my_equal {
    bool operator()(char ch1, char ch2) { return std::tolower(ch1) == std::tolower(ch2); }
};

bool ContainsAnyCase(std::string_view const& str1, std::string_view const& str2) {
    return std::search(str1.begin(), str1.end(), str2.begin(), str2.end(), [](char ch1, char ch2) {
               return std::tolower(ch1) == std::tolower(ch2);
           }) != str1.end();
}

static void CheckAddClass(
    GetTypeComplete const& search, Il2CppClass* clazz, std::set<std::string>& matches, std::string_view namespaze = "", std::string name = ""
) {
    std::string toSearch = clazz->namespaze;
    std::string toAdd = clazz->namespaze;
    std::string_view searchString = search.namespaze();

    if (search.has_clazz()) {
        // I believe nested types have no namespace, but either way we've already checked it
        if (name.empty() && search.has_namespaze() && search.namespaze() != clazz->namespaze)
            return;
        if (namespaze.empty())
            namespaze = clazz->namespaze;
        if (!name.empty())
            name = fmt::format("{}/{}", name, clazz->name);
        else
            name = clazz->name;
        toSearch = name;
        toAdd = fmt::format("{}::{}", namespaze, name);
        searchString = search.clazz();
        // only search nested types if we are looking for classes and not namespaces
        void* iter = nullptr;
        while (auto nested = il2cpp_functions::class_get_nested_types(clazz, &iter))
            CheckAddClass(search, nested, matches, namespaze, name);
    }

    if (ContainsAnyCase(toSearch, searchString))
        matches.emplace(toAdd);
}

std::set<std::string> ClassUtils::SearchClasses(GetTypeComplete const& search) {
    if (!search.has_clazz() && !search.has_namespaze())
        return {};

    std::set<std::string> matches;

    auto domain = il2cpp_functions::domain_get();
    size_t assemblyCount;
    auto assemblies = il2cpp_functions::domain_get_assemblies(domain, &assemblyCount);
    for (size_t i = 0; i < assemblyCount; i++) {
        auto image = assemblies[i]->image;
        if (!image)
            continue;
        for (size_t j = 0; j < image->typeCount; j++) {
            auto clazz = il2cpp_functions::image_get_class(image, j);
            if (clazz)
                CheckAddClass(search, const_cast<Il2CppClass*>(clazz), matches);
        }
    }

    return matches;
}
