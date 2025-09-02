#include "manager.hpp"

#include "MainThreadRunner.hpp"
#include "UnityEngine/Transform.hpp"
#include "classutils.hpp"
#include "main.hpp"
#include "mem.hpp"
#include "methods.hpp"
#include "socket.hpp"
#include "unity.hpp"

#define MESSAGE_LOGGING

using namespace ClassUtils;
using namespace UnityEngine;
using namespace UnityEngine::SceneManagement;

static bool initialized = false;

void Manager::Init() {
    Socket::Init();
    LOG_INFO("Starting server at port 3306");
    Socket::Start(3306);
    initialized = true;
}

bool TryValidatePtr(void const* ptr) {
    if (asInt(ptr) <= 0 || asInt(ptr) > UINTPTR_MAX) {
        LOG_INFO("invalid ptr was {}", fmt::ptr(ptr));
        return false;
    }
    return true;
}

#define INPUT_ERROR(...)                              \
{                                                     \
    LOG_INFO(__VA_ARGS__);                            \
    wrapper.set_inputerror(fmt::format(__VA_ARGS__)); \
}

static void SetField(SetField const& packet, uint64_t queryId) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(queryId);

    auto field = asPtr(FieldInfo, packet.fieldid());

    if (!TryValidatePtr(field))
        INPUT_ERROR("field info pointer was invalid")
    else if (GetIsLiteral(field))
        INPUT_ERROR("literal fields cannot be set")
    else {
        FieldUtils::Set(field, packet.inst(), packet.value());

        SetFieldResult& result = *wrapper.mutable_setfieldresult();
        result.set_fieldid(asInt(field));
    }
    Socket::Send(wrapper);
}

static void GetField(GetField const& packet, uint64_t queryId) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(queryId);

    auto field = asPtr(FieldInfo, packet.fieldid());

    if (!TryValidatePtr(field))
        INPUT_ERROR("field info pointer was invalid")
    else {
        LOG_DEBUG("Getting field {}", packet.fieldid());

        auto res = FieldUtils::Get(field, packet.inst());

        GetFieldResult& result = *wrapper.mutable_getfieldresult();
        result.set_fieldid(asInt(field));

        *result.mutable_value() = res;
    }
    Socket::Send(wrapper);
}

static void InvokeMethod(InvokeMethod const& packet, uint64_t queryId) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(queryId);

    auto method = asPtr(MethodInfo const, packet.methodid());

    if (!TryValidatePtr(method))
        INPUT_ERROR("method info pointer was invalid")
    else {
        bool validGenerics = true;
        if (int size = packet.generics_size()) {
            std::vector<Il2CppClass*> generics{};
            for (int i = 0; i < size; i++) {
                auto clazz = GetClass(packet.generics(i));
                if (!clazz) {
                    INPUT_ERROR("generic {} was invalid", packet.generics(i).ShortDebugString())
                    validGenerics = false;
                    break;
                } else
                    generics.push_back(clazz);
            }
            if (validGenerics)
                method = il2cpp_utils::MakeGenericMethod(method, generics);
        }
        if (validGenerics) {
            std::vector<ProtoDataPayload> args{};
            for (int i = 0; i < packet.args_size(); i++)
                args.emplace_back(packet.args(i));

            std::string err = "";
            auto [ret, byrefs] = MethodUtils::Run(method, packet.inst(), args, err);

            InvokeMethodResult& result = *wrapper.mutable_invokemethodresult();
            result.set_methodid(asInt(method));

            if (!err.empty()) {
                result.set_status(InvokeMethodResult::ERR);
                result.set_error(err);
                Socket::Send(wrapper);
                return;
            }

            result.set_status(InvokeMethodResult::OK);
            *result.mutable_result() = ret;
            result.mutable_byrefchanges()->insert(byrefs.begin(), byrefs.end());
        }
    }
    Socket::Send(wrapper);
}

static void SearchObjects(SearchObjects const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    std::string name = packet.has_name() ? packet.name() : "";

    Il2CppClass* klass = GetClass(packet.componentclass());
    if (!klass) {
        INPUT_ERROR("Could not find class {}", packet.componentclass().DebugString())
        Socket::Send(wrapper);
        return;
    }

    *wrapper.mutable_searchobjectsresult() = FindObjects(klass, name);

    Socket::Send(wrapper);
}

static void GetAllGameObjects(GetAllGameObjects const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    *wrapper.mutable_getallgameobjectsresult() = FindAllGameObjects();

    Socket::Send(wrapper);
}

static void GetGameObjectComponents(GetGameObjectComponents const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    auto gameObject = asPtr(UnityEngine::GameObject, packet.address());

    if (!TryValidatePtr(gameObject))
        INPUT_ERROR("gameObject pointer was invalid")
    else
        *wrapper.mutable_getgameobjectcomponentsresult() = GetComponents(gameObject);

    Socket::Send(wrapper);
}

static void CreateGameObject(CreateGameObject const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    auto go = GameObject::New_ctor(packet.name());
    auto parent = packet.has_parent() ? asPtr(UnityEngine::GameObject, packet.parent()) : nullptr;

    if (packet.has_parent() && !TryValidatePtr(parent))
        INPUT_ERROR("parent pointer was invalid")
    else {
        if (packet.has_parent())
            go->get_transform()->SetParent(parent->get_transform());
        *wrapper.mutable_creategameobjectresult() = CreateGameObjectResult{};
    }
    Socket::Send(wrapper);
}

static void ReadMemory(ReadMemory const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    auto src = asPtr(void, packet.address());

    if (!TryValidatePtr(src))
        INPUT_ERROR("src pointer was invalid")
    else {
        ReadMemoryResult& result = *wrapper.mutable_readmemoryresult();
        result.set_address(packet.address());

        auto size = packet.size();
        if (mem::protect(src, size, mem::protection::read_write_execute)) {
            result.set_status(ReadMemoryResult_Status::ReadMemoryResult_Status_ERR);
        } else {
            result.set_status(ReadMemoryResult_Status::ReadMemoryResult_Status_OK);
            result.set_data(src, size);
        }
        LOG_DEBUG("Result is {}", wrapper.DebugString());
    }
    Socket::Send(wrapper);
}

static void WriteMemory(WriteMemory const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    auto dst = asPtr(void, packet.address());

    if (!TryValidatePtr(dst))
        INPUT_ERROR("dst pointer was invalid")
    else {
        WriteMemoryResult& result = *wrapper.mutable_writememoryresult();
        result.set_address(packet.address());

        auto src = packet.data().data();
        auto size = packet.data().size();
        if (mem::protect(dst, size, mem::protection::read_write_execute)) {
            result.set_status(WriteMemoryResult_Status::WriteMemoryResult_Status_ERR);
        } else {
            result.set_status(WriteMemoryResult_Status::WriteMemoryResult_Status_OK);
            result.set_size(size);
            memcpy(dst, src, size);
        }
        LOG_DEBUG("Result is {}", wrapper.DebugString());
    }
    Socket::Send(wrapper);
}

std::unordered_map<Il2CppClass const*, ProtoClassDetails> cachedClasses;

ProtoClassDetails getClassDetails_internal(Il2CppClass* clazz) {
    if (clazz == nullptr)
        return ProtoClassDetails();  // don't add to cache

    auto cached = cachedClasses.find(clazz);
    if (cached != cachedClasses.end()) {
        LOG_DEBUG("Returning cached details for {}::{}", il2cpp_functions::class_get_namespace(clazz), il2cpp_functions::class_get_name(clazz));
        return cached->second;
    }

    ProtoClassDetails ret;

    auto const* currentClass = clazz;
    auto currentClassProto = &ret;

    // Use a while loop instead of recursive
    // method to improve stack allocations
    while (currentClass != nullptr) {
        LOG_DEBUG(
            "Finding class details for {}::{}", il2cpp_functions::class_get_namespace(currentClass), il2cpp_functions::class_get_name(currentClass)
        );
        *currentClassProto->mutable_clazz() = GetClassInfo(typeofclass(currentClass));

        for (auto f : GetFields(currentClass)) {
            if (GetIsStatic(f))
                *currentClassProto->add_staticfields() = FieldUtils::GetFieldInfo(f);
            else
                *currentClassProto->add_fields() = FieldUtils::GetFieldInfo(f);
        }

        std::set<MethodInfo const*> propertyMethods = {};
        for (auto p : GetProperties(currentClass)) {
            propertyMethods.insert(p->get);
            propertyMethods.insert(p->set);
            if (GetIsStatic(p))
                *currentClassProto->add_staticproperties() = MethodUtils::GetPropertyInfo(p);
            else
                *currentClassProto->add_properties() = MethodUtils::GetPropertyInfo(p);
        }

        for (auto const& m : GetMethods(currentClass)) {
            if (propertyMethods.find(m) != propertyMethods.end())
                continue;
            if (GetIsStatic(m))
                *currentClassProto->add_staticmethods() = MethodUtils::GetMethodInfo(m);
            else
                *currentClassProto->add_methods() = MethodUtils::GetMethodInfo(m);
        }

        for (auto i : GetInterfaces(currentClass))
            *currentClassProto->add_interfaces() = GetClassInfo(typeofclass(i));

        currentClass = GetParent(currentClass);
        if (currentClass)
            currentClassProto = currentClassProto->mutable_parent();
    }

    // while loop means I can't add the parents to the cache in it
    // because it goes in the wrong order, so parents aren't filled out when they would be added
    currentClass = clazz;
    currentClassProto = &ret;

    while (currentClass != nullptr) {
        cachedClasses[currentClass] = *currentClassProto;
        currentClass = GetParent(currentClass);
        if (currentClass)
            currentClassProto = currentClassProto->mutable_parent();
    }

    return ret;
}

static void GetClassDetails(GetClassDetails const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    auto result = wrapper.mutable_getclassdetailsresult();

    Il2CppClass* klass = GetClass(packet.classinfo());
    if (!klass) {
        INPUT_ERROR("Could not find class {}", packet.classinfo().DebugString())
        Socket::Send(wrapper);
        return;
    }

    *result->mutable_classdetails() = getClassDetails_internal(klass);

    Socket::Send(wrapper);
}

static void GetInstanceClass(GetInstanceClass const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    auto instance = asPtr(Il2CppObject, packet.address());

    if (!TryValidatePtr(instance))
        INPUT_ERROR("instance pointer was invalid")
    else {
        auto result = wrapper.mutable_getinstanceclassresult();
        *result->mutable_classinfo() = GetClassInfo(typeofinst(instance));
    }

    Socket::Send(wrapper);
}

GetInstanceValuesResult getInstanceValues_internal(Il2CppObject* instance, ProtoClassDetails const* classDetails) {
    GetInstanceValuesResult ret;

    while (classDetails) {
        for (int i = 0; i < classDetails->fields_size(); i++) {
            auto field = classDetails->fields(i);
            auto fieldInfo = asPtr(FieldInfo, field.id());
            (*ret.mutable_fieldvalues())[field.id()] = FieldUtils::Get(fieldInfo, instance).data();
        }
        for (int i = 0; i < classDetails->properties_size(); i++) {
            auto prop = classDetails->properties(i);
            if (!prop.has_getterid() || !prop.getterid())
                continue;
            auto getter = asPtr(MethodInfo, prop.getterid());
            std::string err = "";
            auto [res, _] = MethodUtils::Run(getter, instance, {}, err);
            if (!err.empty())
                LOG_ERROR("getting property failed with error: {}", err);
            else
                (*ret.mutable_propertyvalues())[prop.getterid()] = res.data();
        }
        if (!classDetails->has_parent())
            break;
        classDetails = &classDetails->parent();
    }

    return ret;
}

static void GetInstanceValues(GetInstanceValues const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    auto instance = asPtr(Il2CppObject, packet.address());

    LOG_DEBUG("Requesting values of {}", packet.address());
    if (!TryValidatePtr(instance))
        INPUT_ERROR("instance pointer was invalid")
    else {
        auto details = getClassDetails_internal(instance->klass);
        *wrapper.mutable_getinstancevaluesresult() = getInstanceValues_internal(instance, &details);
    }
    Socket::Send(wrapper);
}

static void GetInstanceDetails(GetInstanceDetails const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    LOG_DEBUG("Requesting details of {}", packet.address());
    auto instance = asPtr(Il2CppObject, packet.address());

    if (!TryValidatePtr(instance))
        INPUT_ERROR("instance pointer was invalid")
    else {
        auto result = wrapper.mutable_getinstancedetailsresult();
        auto classDetails = result->mutable_classdetails();
        *classDetails = getClassDetails_internal(instance->klass);
        *result->mutable_values() = getInstanceValues_internal(instance, classDetails);
    }
    Socket::Send(wrapper);
}

static void SendSafePtrList(uint64_t id);

static void AddSafePtrAddress(AddSafePtrAddress const& addPacket, uint64_t id) {
    auto addr = asPtr(Il2CppObject, addPacket.address());
    if (addPacket.remove())
        QRUE::MainThreadRunner::RemoveKeepAlive(addr);
    else
        QRUE::MainThreadRunner::AddKeepAlive(addr);
    SendSafePtrList(id);
}

static void SendSafePtrList(uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    auto res = wrapper.mutable_getsafeptraddressesresult();
    auto& resMap = *res->mutable_address();

    auto objs = QRUE::MainThreadRunner::GetInstance()->keepAliveObjects;
    for (auto const& addr : objs)
        resMap[asInt(addr)] = ClassUtils::GetClassInfo(typeofclass(addr->klass));

    Socket::Send(wrapper);
}

static void GetTypeComplete(GetTypeComplete const& packet, uint64_t id) {
    PacketWrapper wrapper;
    wrapper.set_queryresultid(id);

    auto& res = *wrapper.mutable_gettypecompleteresult();
    auto& list = *res.mutable_options();

    auto found = ClassUtils::SearchClasses(packet);
    list.Add(found.begin(), found.end());

    Socket::Send(wrapper);
}

void Manager::ProcessMessage(PacketWrapper const& packet) {
    QRUE::MainThreadRunner::Schedule([packet] {
        LOG_DEBUG("processing packet: {}", packet.DebugString());
        auto id = packet.queryresultid();

        switch (packet.Packet_case()) {
            case PacketWrapper::kInvokeMethod:
                InvokeMethod(packet.invokemethod(), id);
                break;
            case PacketWrapper::kSetField:
                SetField(packet.setfield(), id);
                break;
            case PacketWrapper::kGetField:
                GetField(packet.getfield(), id);
                break;
            case PacketWrapper::kSearchObjects:
                SearchObjects(packet.searchobjects(), id);
                break;
            case PacketWrapper::kGetAllGameObjects:
                GetAllGameObjects(packet.getallgameobjects(), id);
                break;
            case PacketWrapper::kGetGameObjectComponents:
                GetGameObjectComponents(packet.getgameobjectcomponents(), id);
                break;
            case PacketWrapper::kReadMemory:
                ReadMemory(packet.readmemory(), id);
                break;
            case PacketWrapper::kWriteMemory:
                WriteMemory(packet.writememory(), id);
                break;
            case PacketWrapper::kGetClassDetails:
                GetClassDetails(packet.getclassdetails(), id);
                break;
            case PacketWrapper::kGetInstanceClass:
                GetInstanceClass(packet.getinstanceclass(), id);
                break;
            case PacketWrapper::kGetInstanceValues:
                GetInstanceValues(packet.getinstancevalues(), id);
                break;
            case PacketWrapper::kGetInstanceDetails:
                GetInstanceDetails(packet.getinstancedetails(), id);
                break;
            case PacketWrapper::kCreateGameObject:
                CreateGameObject(packet.creategameobject(), id);
                break;
            case PacketWrapper::kAddSafePtrAddress:
                AddSafePtrAddress(packet.addsafeptraddress(), id);
                break;
            case PacketWrapper::kGetSafePtrAddresses:
                SendSafePtrList(id);
                break;
            case PacketWrapper::kGetTypeComplete:
                GetTypeComplete(packet.gettypecomplete(), id);
                break;
            default:
                LOG_ERROR("Invalid packet type {}!", (int) packet.Packet_case());
        }
    });
}
