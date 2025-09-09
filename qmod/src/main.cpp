#include "main.hpp"

#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>

#include "MainThreadRunner.hpp"
#include "UnityEngine/Color.hpp"
#include "UnityEngine/Events/UnityAction_2.hpp"
#include "UnityEngine/FilterMode.hpp"
#include "UnityEngine/GameObject.hpp"
#include "UnityEngine/Matrix4x4.hpp"
#include "UnityEngine/Rect.hpp"
#include "UnityEngine/RenderTexture.hpp"
#include "UnityEngine/RenderTextureFormat.hpp"
#include "UnityEngine/RenderTextureReadWrite.hpp"
#include "UnityEngine/Resources.hpp"
#include "UnityEngine/SceneManagement/LoadSceneMode.hpp"
#include "UnityEngine/SceneManagement/Scene.hpp"
#include "UnityEngine/SceneManagement/SceneManager.hpp"
#include "UnityEngine/StereoTargetEyeMask.hpp"
#include "UnityEngine/TextureWrapMode.hpp"
#include "beatsaber-hook/shared/config/config-utils.hpp"
#include "beatsaber-hook/shared/utils/hooking.hpp"
#include "custom-types/shared/delegate.hpp"
#include "custom-types/shared/register.hpp"
#include "manager.hpp"
#include "scotland2/shared/modloader.h"

static modloader::ModInfo modInfo{MOD_ID, VERSION, 1};

extern "C" void setup(CModInfo* info) {
    Paper::Logger::RegisterFileContextId(MOD_ID);

    *info = modInfo.to_c();

    setenv("QuestRUE", "", 0);

    LOG_INFO("Completed setup!");
}

#ifdef BEAT_SABER
#include "GlobalNamespace/DefaultScenesTransitionsFromInit.hpp"

using namespace GlobalNamespace;

MAKE_HOOK_MATCH(
    DefaultScenesTransitionsFromInit_TransitionToNextScene,
    &DefaultScenesTransitionsFromInit::TransitionToNextScene,
    void,
    DefaultScenesTransitionsFromInit* self,
    bool goStraightToMenu,
    bool goStraightToEditor,
    bool goToRecordingToolScene,
    System::Action* onFinishShaderWarmup
) {
    DefaultScenesTransitionsFromInit_TransitionToNextScene(self, true, goStraightToEditor, goToRecordingToolScene, onFinishShaderWarmup);
}
#endif

extern "C" void load() {
    il2cpp_functions::Init();

    custom_types::Register::AutoRegister();

#ifdef BEAT_SABER
    LOG_INFO("Installing hooks...");
    INSTALL_HOOK(logger, DefaultScenesTransitionsFromInit_TransitionToNextScene);
    LOG_INFO("Installed hooks!");
#endif

    LOG_INFO("Initializing connection manager");
    Manager::Init();
    LOG_INFO("Completed load!");
}

extern "C" void late_load() {
    LOG_INFO("Initializing main thread runner");
    QRUE::MainThreadRunner::Init();
}
