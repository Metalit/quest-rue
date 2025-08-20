#pragma once

#include "UnityEngine/MonoBehaviour.hpp"
#include "custom-types/shared/macros.hpp"

DECLARE_CLASS_CODEGEN(QRUE, MainThreadRunner, UnityEngine::MonoBehaviour) {
    DECLARE_INSTANCE_FIELD(ListW<Il2CppObject*>, keepAliveObjects);
    DECLARE_INSTANCE_METHOD(void, Awake);
    DECLARE_INSTANCE_METHOD(void, Update);

    DECLARE_STATIC_METHOD(void, AddKeepAlive, Il2CppObject* obj);
    DECLARE_STATIC_METHOD(void, RemoveKeepAlive, Il2CppObject* obj);
    DECLARE_STATIC_METHOD(MainThreadRunner*, GetInstance);

   public:
    static void Schedule(std::function<void()> const& func);
};
