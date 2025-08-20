#include "unity.hpp"

#include "UnityEngine/Component.hpp"
#include "UnityEngine/Object.hpp"
#include "UnityEngine/Resources.hpp"
#include "UnityEngine/SceneManagement/Scene.hpp"
#include "UnityEngine/Transform.hpp"
#include "classutils.hpp"
#include "main.hpp"

using namespace UnityEngine;

ProtoTransform ReadTransform(Transform* obj) {
    ProtoTransform packet;
    packet.set_address(asInt(obj));
    packet.set_name(obj->get_name());

    packet.set_childcount(obj->get_childCount());
    packet.set_parent(asInt(obj->GetParent().unsafePtr()));
    return packet;
}

ProtoGameObject ReadGameObject(GameObject* obj) {
    ProtoGameObject packet;
    packet.set_address(asInt(obj));
    packet.set_name(obj->get_name());

    packet.set_active(obj->get_active());
    packet.set_layer(obj->get_layer());
    packet.set_scene(obj->get_scene().get_handle());
    packet.set_tag(obj->get_tag());
    *packet.mutable_transform() = ReadTransform(obj->get_transform());
    return packet;
}

GetGameObjectComponentsResult GetComponents(UnityEngine::GameObject* obj) {
    GetGameObjectComponentsResult result;

    for (auto const comp : obj->GetComponents<Component*>()) {
        ProtoComponent& found = *result.add_components();

        found.set_address(asInt(comp));
        found.set_name(comp->get_name());
        *found.mutable_classinfo() = ClassUtils::GetClassInfo(typeofinst(comp));
    }

    return result;
}

static SearchObjectsResult ConvertObjects(std::span<UnityW<Object>> arr) {
    SearchObjectsResult result;
    for (auto obj : arr) {
        ProtoObject& found = *result.add_objects();
        found.set_address(asInt(obj.unsafePtr()));
        found.set_name(obj->get_name());
        *found.mutable_classinfo() = ClassUtils::GetClassInfo(typeofinst(obj));
    }
    return result;
}

SearchObjectsResult FindObjects(Il2CppClass* klass, std::string name) {
    LOG_DEBUG("Searching for objects");
    auto objects = Resources::FindObjectsOfTypeAll(reinterpret_cast<System::Type*>(il2cpp_utils::GetSystemType(klass)));

    if (!name.empty()) {
        LOG_DEBUG("Searching for name {}", name);
        StringW il2cppName(name);
        std::vector<UnityW<Object>> namedObjs;
        for (auto obj : objects) {
            if (obj->get_name()->Contains(il2cppName))
                namedObjs.push_back(obj);
        }
        return ConvertObjects(namedObjs);
    }
    return ConvertObjects(objects.ref_to());
}

GetAllGameObjectsResult FindAllGameObjects() {
    GetAllGameObjectsResult result;

    auto objects = Resources::FindObjectsOfTypeAll<GameObject*>();
    result.mutable_objects()->Reserve(objects.size());
    LOG_DEBUG("found {} game objects", objects.size());
    for (auto const& obj : objects)
        *result.add_objects() = ReadGameObject(obj);

    return result;
}
