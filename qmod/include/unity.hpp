#pragma once

#include "UnityEngine/GameObject.hpp"
#include "qrue.pb.h"

ProtoGameObject ReadGameObject(UnityEngine::GameObject* obj);

GetGameObjectComponentsResult GetComponents(UnityEngine::GameObject* obj);
SearchObjectsResult FindObjects(Il2CppClass* clazz, std::string name);
GetAllGameObjectsResult FindAllGameObjects();
