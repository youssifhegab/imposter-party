package com.imposter.api

import com.imposter.engine.GameEngine
import com.imposter.engine.Lang
import com.imposter.engine.Rules
import com.imposter.engine.WordBank
import com.imposter.protocol.ProtocolError
import com.imposter.room.JoinResult
import com.imposter.room.RoomManager
import jakarta.servlet.http.HttpServletRequest
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

data class CategoryResponse(val id: String, val name: String, val icon: String, val wordCount: Int)

data class CreateRoomRequest(val name: String, val avatar: Int, val language: String? = null)

data class JoinRoomRequest(val name: String, val avatar: Int)

data class CredentialsResponse(val roomCode: String, val playerId: String, val playerToken: String)

/** REST covers only what happens before a player has a socket. Everything else is in GameSocketHandler. */
@RestController
@RequestMapping("/api")
class RoomController(
    private val rooms: RoomManager,
    private val words: WordBank,
    private val rateLimiter: JoinRateLimiter,
) {
    @GetMapping("/categories")
    fun categories(@RequestParam(defaultValue = "en") lang: String): List<CategoryResponse> {
        val language = Lang.fromCode(lang) ?: throw invalidInput()
        return words.categories
            .filter { words.hasWords(it.slug, language) }
            .map {
                CategoryResponse(it.slug, words.categoryName(it.slug, language), it.icon, words.wordsIn(it.slug, language).size)
            }
    }

    @PostMapping("/rooms")
    fun create(@RequestBody body: CreateRoomRequest, request: HttpServletRequest): CredentialsResponse {
        rateLimiter.check(request.remoteAddr)
        val name = GameEngine.cleanName(body.name) ?: throw invalidInput()
        if (body.avatar !in 0 until Rules.AVATAR_COUNT) throw invalidInput()
        val language = body.language?.let { Lang.fromCode(it) ?: throw invalidInput() } ?: Lang.EN
        val credentials = rooms.create(name, body.avatar, language)
        return CredentialsResponse(credentials.roomCode, credentials.playerId, credentials.playerToken)
    }

    @PostMapping("/rooms/{code}/join")
    fun join(@PathVariable code: String, @RequestBody body: JoinRoomRequest, request: HttpServletRequest): CredentialsResponse {
        rateLimiter.check(request.remoteAddr)
        // runBlocking bridges this ordinary (thread-per-request) MVC handler to the room's suspending API.
        // It waits on the request thread, which is fine here: joining takes a few milliseconds.
        val result = runBlocking { withTimeout(JOIN_TIMEOUT_MS) { rooms.join(code, body.name, body.avatar) } }
        return when (result) {
            is JoinResult.Joined -> result.credentials.let { CredentialsResponse(it.roomCode, it.playerId, it.playerToken) }
            is JoinResult.Rejected -> throw ApiException(statusFor(result.code), result.code)
        }
    }

    private fun statusFor(code: String) = when (code) {
        ProtocolError.ROOM_NOT_FOUND -> HttpStatus.NOT_FOUND
        "room_full", "name_taken" -> HttpStatus.CONFLICT
        else -> HttpStatus.BAD_REQUEST
    }

    private fun invalidInput() = ApiException(HttpStatus.BAD_REQUEST, ProtocolError.INVALID_INPUT)

    companion object {
        private const val JOIN_TIMEOUT_MS = 5_000L
    }
}
