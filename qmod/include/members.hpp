#pragma once

#include "beatsaber-hook/shared/utils/il2cpp-utils.hpp"
#include "qrue.pb.h"

namespace MethodUtils {
    struct MethodResult {
        ProtoDataPayload result;
        std::map<int, ProtoDataPayload> byrefs;
        std::string error = "";
        std::optional<ProtoDataSegment> self = std::nullopt;
    };

    MethodResult Run(MethodInfo const* method, ProtoDataPayload const& object, std::vector<ProtoDataPayload> const& args);
    MethodResult Run(MethodInfo const* method, void* object, std::vector<ProtoDataPayload> const& args);

    ProtoPropertyInfo GetPropertyInfo(PropertyInfo const* property);
    ProtoMethodInfo GetMethodInfo(MethodInfo const* method);
};

namespace FieldUtils {
    ProtoDataPayload Get(FieldInfo const* field, ProtoDataPayload const& object);
    ProtoDataPayload Get(FieldInfo const* field, void* object, bool isObject = true);
    void Set(FieldInfo const* field, ProtoDataPayload const& object, ProtoDataPayload const& arg);
    void Set(FieldInfo const* field, void* object, ProtoDataPayload const& arg, bool isObject = true);

    ProtoFieldInfo GetFieldInfo(FieldInfo const* field);
}
