#pragma once

#include "qrue.pb.h"

namespace Socket {
    void Init();
    bool Start(int port);
    void Stop();
    void Send(PacketWrapper const& packet);
}
