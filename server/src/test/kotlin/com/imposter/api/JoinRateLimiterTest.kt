package com.imposter.api

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpStatus
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.assertEquals

class JoinRateLimiterTest {
    private class MutableClock(var millis: Long) : Clock() {
        override fun getZone() = ZoneOffset.UTC
        override fun withZone(zone: java.time.ZoneId?) = this
        override fun instant(): Instant = Instant.ofEpochMilli(millis)
    }

    @Test
    fun `limits each IP separately and resets after a minute`() {
        val clock = MutableClock(0)
        val limiter = JoinRateLimiter(clock, limit = 3)
        repeat(3) { limiter.check("1.1.1.1") }
        val error = assertThrows<ApiException> { limiter.check("1.1.1.1") }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.status)
        assertEquals("rate_limited", error.code)

        limiter.check("2.2.2.2")
        clock.millis = 60_000
        limiter.check("1.1.1.1")
    }
}
