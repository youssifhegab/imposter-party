package com.imposter.room

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean

@Configuration
@EnableWebSocket
class WebSocketConfig(private val handler: GameSocketHandler) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        // Native apps don't send a browser Origin header, so there is nothing meaningful to restrict here.
        // Every message is authorized by the player token instead.
        registry.addHandler(handler, "/ws").setAllowedOrigins("*")
    }

    @Bean
    fun webSocketContainer() = ServletServerContainerFactoryBean().apply {
        setMaxTextMessageBufferSize(MAX_MESSAGE_BYTES)
        // Clients ping every 15s. A socket silent for 40s is dead (e.g. airplane mode), so close it and let
        // the player's grace period start.
        setMaxSessionIdleTimeout(IDLE_TIMEOUT_MS)
    }

    companion object {
        private const val MAX_MESSAGE_BYTES = 8 * 1024
        private const val IDLE_TIMEOUT_MS = 40_000L
    }
}
