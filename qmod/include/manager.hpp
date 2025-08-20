#pragma once

#include "qrue.pb.h"

namespace Manager {
    void Init();
    void ProcessMessage(PacketWrapper const& packet);
}
