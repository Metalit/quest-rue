#include "MainThreadRunner.hpp"

#include "main.hpp"

#include <thread>

DEFINE_TYPE(QRUE, MainThreadRunner);

using namespace QRUE;

static std::thread::id mainThreadId;
static std::vector<std::function<void()>> scheduledFunctions;
static std::mutex scheduleLock;
static MainThreadRunner* instance;

void MainThreadRunner::Awake() {
    mainThreadId = std::this_thread::get_id();
    instance = this;
    this->keepAliveObjects = System::Collections::Generic::List_1<Il2CppObject*>::New_ctor();
}

void MainThreadRunner::Schedule(std::function<void()> const& func) {
    if (mainThreadId == std::this_thread::get_id())
        func();
    else {
        std::unique_lock<std::mutex> lock(scheduleLock);
        scheduledFunctions.emplace_back(func);
    }
}

MainThreadRunner* MainThreadRunner::GetInstance() {
    return instance;
}

void MainThreadRunner::Update() {
    if (scheduledFunctions.empty())
        return;

    std::unique_lock<std::mutex> lock(scheduleLock);
    std::vector<std::function<void()>> copiedFunctions;
    scheduledFunctions.swap(copiedFunctions);
    lock.unlock();

    for (auto const& function : copiedFunctions)
        function();
}

void MainThreadRunner::AddKeepAlive(Il2CppObject* obj) {
    auto objects = GetInstance()->keepAliveObjects;
    if (objects->Contains(obj))
        return;
    objects->Add(obj);
}

void MainThreadRunner::RemoveKeepAlive(Il2CppObject* obj) {
    GetInstance()->keepAliveObjects->Remove(obj);
}
