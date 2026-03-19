import {
  Body,
  Controller,
  Inject,
  Logger,
  Param,
  Post,
  Res
} from "@nestjs/common";
import type { Response as ExpressResponse } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { ElevenLabsService } from "./elevenlabs.service";
import type { ChatCompletionRequestDto } from "./dto/chat-completion.dto";

/**
 * ElevenLabs Conversational AI integration endpoints.
 *
 * 1. POST /interviews/elevenlabs/chat/completions
 *    Custom LLM endpoint — ElevenLabs sends OpenAI-compatible requests here.
 *    Must be @Public() because ElevenLabs Cloud calls it directly.
 *
 * 2. POST /interviews/public/sessions/:id/elevenlabs-init
 *    Frontend calls this to get a signed WebRTC conversation URL.
 */
@Controller("interviews")
export class ElevenLabsController {
  private readonly logger = new Logger(ElevenLabsController.name);

  constructor(
    @Inject(ElevenLabsService) private readonly elevenLabsService: ElevenLabsService
  ) {}

  /**
   * Custom LLM endpoint for ElevenLabs Conversational AI.
   *
   * ElevenLabs sends the full conversation as OpenAI-compatible chat completion request.
   * We process the latest user message (candidate's transcribed speech),
   * delegate to InterviewsService, and stream the next question back.
   *
   * Response format: Server-Sent Events (SSE) with OpenAI chat completion chunks.
   */
  @Public()
  @Post("elevenlabs/chat/completions")
  async chatCompletions(
    @Body() body: ChatCompletionRequestDto,
    @Res() res: ExpressResponse
  ) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    try {
      const result = await this.elevenLabsService.processConversationTurn(
        body.messages ?? []
      );

      // Stream the response word by word for natural TTS pacing
      const words = result.text.split(/(\s+)/);
      for (const chunk of words) {
        if (chunk.length === 0) continue;
        const payload = JSON.stringify({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion.chunk",
          choices: [
            {
              index: 0,
              delta: { content: chunk },
              finish_reason: null
            }
          ]
        });
        res.write(`data: ${payload}\n\n`);
      }

      // Send final chunk with finish_reason
      const finalPayload = JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop"
          }
        ]
      });
      res.write(`data: ${finalPayload}\n\n`);
      res.write("data: [DONE]\n\n");
    } catch (error) {
      this.logger.error(
        "ElevenLabs chat completion error",
        error instanceof Error ? error.stack : error
      );

      // Even on error, respond with a spoken message rather than an HTTP error
      const errorPayload = JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        choices: [
          {
            index: 0,
            delta: {
              content: "Bir teknik sorun olustu. Lutfen biraz bekleyin."
            },
            finish_reason: "stop"
          }
        ]
      });
      res.write(`data: ${errorPayload}\n\n`);
      res.write("data: [DONE]\n\n");
    }

    res.end();
  }

  /**
   * Initialize an ElevenLabs conversation for a candidate session.
   * Returns a signed WebRTC URL that the frontend uses to connect.
   */
  @Public()
  @Post("public/sessions/:id/elevenlabs-init")
  async initElevenLabsConversation(
    @Param("id") sessionId: string,
    @Body() body: { token: string }
  ) {
    const result = await this.elevenLabsService.createSignedConversationUrl({
      sessionId,
      accessToken: body.token,
      traceId: `elevenlabs_init_${Date.now()}`
    });

    return {
      signedUrl: result.signedUrl,
      agentId: result.agentId
    };
  }
}
