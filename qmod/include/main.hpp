#pragma once

#include "beatsaber-hook/shared/utils/logging.hpp"

#define asInt(p) reinterpret_cast<std::uintptr_t>(p)
#define asPtr(type, p) reinterpret_cast<type*>(p)

static constexpr auto logger = Paper::ConstLoggerContext(MOD_ID);

#define LOG_INFO(...) logger.info(__VA_ARGS__)
#define LOG_ERROR(...) logger.error(__VA_ARGS__)
#define LOG_DEBUG(...) logger.debug(__VA_ARGS__)
// #define LOG_DEBUG(...)

std::string_view GetDataPath();
