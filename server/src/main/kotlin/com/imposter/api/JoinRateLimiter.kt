package com.imposter.api

import com.imposter.protocol.ProtocolError
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import java.time.Clock
import java.util.concurrent.ConcurrentHashMap

/** Caps room creates and joins per IP address in a fixed one-minute window. */
@Component
class JoinRateLimiter(
    private val clock: Clock,
    // @Value reads a config property, with the default after the colon.
    @Value("\${imposter.join-rate-limit-per-minute:20}") private val limit: Int,
) {
    private data class Window(val startedAt: Long, val count: Int)

    private val windows = ConcurrentHashMap<String, Window>()

    fun check(ip: String) {
        val now = clock.millis()
        if (windows.size > MAX_TRACKED_IPS) windows.values.removeIf { now - it.startedAt >= WINDOW_MS }
        // compute() runs atomically per key, so two simultaneous requests from one IP can't both slip through.
        val window = windows.compute(ip) { _, current ->
            if (current == null || now - current.startedAt >= WINDOW_MS) Window(now, 1) else current.copy(count = current.count + 1)
        }!!
        if (window.count > limit) throw ApiException(HttpStatus.TOO_MANY_REQUESTS, ProtocolError.RATE_LIMITED)
    }

    companion object {
        private const val WINDOW_MS = 60_000L
        private const val MAX_TRACKED_IPS = 10_000
    }
}
