#include "socket.hpp"

#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>

#include "MainThreadRunner.hpp"
#include "main.hpp"
#include "manager.hpp"

using namespace websocketpp;

static bool initialized = false;
static server<config::asio> socketServer;
static std::shared_mutex connectionsMutex;
static std::set<connection_hdl, std::owner_less<connection_hdl>> connections;
static bool threadRunning = false;

static void OpenHandler(connection_hdl connection) {
    LOG_INFO("connected: {}", connection.lock().get());
    std::unique_lock lock(connectionsMutex);
    connections.emplace(connection);
}

static void CloseHandler(connection_hdl connection) {
    LOG_INFO("disconnected: {}", connection.lock().get());
    std::unique_lock lock(connectionsMutex);
    connections.erase(connection);
}

static void MessageHandler(connection_hdl connection, server<config::asio>::message_ptr message) {
    PacketWrapper packet;
    packet.ParseFromArray(message->get_payload().data(), message->get_payload().size());
    QRUE::MainThreadRunner::Schedule([packet = std::move(packet)]() { Manager::ProcessMessage(packet); });
}

bool Socket::Start(int port) {
    try {
        socketServer.listen(lib::asio::ip::tcp::v4(), port);

        socketServer.start_accept();

        std::thread([]() {
            threadRunning = true;
            socketServer.run();
            threadRunning = false;
        }).detach();

        lib::asio::error_code ec;
        auto endpoint = socketServer.get_local_endpoint(ec);

        if (ec.failed())
            LOG_ERROR("not listening: {}", ec.message());
        else {
            LOG_INFO(
                "listening on {}:{} ipv4 {} ipv6 {}",
                endpoint.address().to_string(ec),
                endpoint.port(),
                endpoint.address().is_v4(),
                endpoint.address().is_v6()
            );

            if (endpoint.address().is_v4())
                LOG_DEBUG("v4 {}:{}", endpoint.address().to_v4().to_string(ec), endpoint.port());

            if (endpoint.address().is_v6())
                LOG_DEBUG(
                    "v6 {}:{} v4 compatible {}",
                    endpoint.address().to_v6().to_string(ec),
                    endpoint.port(),
                    endpoint.address().to_v6().is_v4_compatible()
                );
        }

        return true;
    } catch (std::exception const& exc) {
        LOG_ERROR("socket listen failed: {}", exc.what());
        return false;
    }
}

void Socket::Stop() {
    try {
        if (threadRunning) {
            socketServer.stop_listening();

            std::unique_lock lock(connectionsMutex);
            for (auto& connection : connections)
                socketServer.close(connection, close::status::going_away, "configuration change");
            connections.clear();
        }
    } catch (std::exception const& exc) {
        LOG_ERROR("socket closing failed: {}", exc.what());
    }
}

void Socket::Init() {
    if (initialized)
        return;

    LOG_INFO("initializing socket");
    try {
        socketServer.set_access_channels(log::alevel::none);
        socketServer.set_error_channels(log::elevel::none);

        socketServer.init_asio();
        socketServer.set_reuse_addr(true);

        socketServer.set_open_handler(OpenHandler);
        socketServer.set_close_handler(CloseHandler);
        socketServer.set_message_handler(MessageHandler);
    } catch (std::exception const& exc) {
        LOG_ERROR("socket init failed: {}", exc.what());
    }
}

void Socket::Send(PacketWrapper const& packet) {
    if (!packet.IsInitialized())
        return;
    auto string = packet.SerializeAsString();
    std::shared_lock lock(connectionsMutex);
    for (auto const& hdl : connections) {
        try {
            socketServer.send(hdl, string, frame::opcode::value::BINARY);
        } catch (std::exception const& e) {
            LOG_ERROR("send failed: {}", e.what());
        }
    }
}
