package com.imposter.api

import com.imposter.room.TestContent
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.context.annotation.Import
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.test.context.ActiveProfiles
import kotlin.test.assertEquals

/**
 * As deployed behind Render's proxy: every request arrives from the proxy, and the player's IP is in
 * X-Forwarded-For. The join rate limit must count per player, not for everyone behind the proxy at once.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = ["server.forward-headers-strategy=native", "imposter.join-rate-limit-per-minute=2"],
)
@ActiveProfiles("test")
@Import(TestContent::class)
class ForwardedIpTest {
    @Autowired
    lateinit var rest: TestRestTemplate

    private fun create(clientIp: String): HttpStatus {
        val headers = HttpHeaders().apply { set("X-Forwarded-For", clientIp) }
        val body = mapOf("name" to "Alice", "avatar" to 0)
        return HttpStatus.valueOf(rest.postForEntity("/api/rooms", HttpEntity(body, headers), String::class.java).statusCode.value())
    }

    @Test
    fun `the rate limit counts each forwarded client separately`() {
        assertEquals(HttpStatus.OK, create("203.0.113.7"))
        assertEquals(HttpStatus.OK, create("203.0.113.7"))
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, create("203.0.113.7"))
        assertEquals(HttpStatus.OK, create("198.51.100.4"), "another player behind the same proxy isn't blocked")
    }

    @Test
    fun `a faked header can't dodge the limit, because only private-network proxies are trusted`() {
        // The real client 192.0.2.9 claims to be someone else; the proxy appends the address it actually saw.
        repeat(2) { create("1.1.1.$it, 192.0.2.9") }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, create("8.8.8.8, 192.0.2.9"))
    }
}
