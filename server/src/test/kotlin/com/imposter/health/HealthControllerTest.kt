package com.imposter.health

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

// @WebMvcTest boots only the web layer (no database), so this runs without Docker.
@WebMvcTest(HealthController::class)
class HealthControllerTest(@Autowired private val mvc: MockMvc) {
    @Test
    fun `health returns 200 ok`() {
        mvc.get("/api/health").andExpect {
            status { isOk() }
            jsonPath("$.status") { value("ok") }
        }
    }
}
