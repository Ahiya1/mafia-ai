// server/lib/game/ai/prompt-builder.ts - Context → AI Prompts
import { AIDecisionContext, AIPersonality } from "../../types/ai";
import { PlayerRole, GamePhase } from "../../types/game";

export interface PromptBuilderInterface {
  buildDiscussionPrompt(
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): string;
  buildVotingPrompt(
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): string;
  buildNightActionPrompt(
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): string;
}

export class PromptBuilder implements PromptBuilderInterface {
  private buildBaseContext(
    context: AIDecisionContext,
    personality: AIPersonality
  ): string {
    return `You are playing AI Mafia, a social deduction game. 

## YOUR IDENTITY
- Your name: ${context.playerId}
- Your role: ${context.role}
- Your personality: ${personality.name} (${personality.archetype})
- Communication style: ${personality.communicationStyle.formalityLevel}, ${
      personality.communicationStyle.emotionalExpression
    } emotion
- Strategic approach: ${
      personality.strategicApproach.riskTolerance
    } risk tolerance

## GAME SITUATION
- Current phase: ${context.phase}
- Round: ${context.round}
- Living players: ${context.livingPlayers.length}
- Players eliminated: ${context.eliminatedPlayers.length}
- Time remaining: ${Math.round(context.timeRemaining / 1000)}s

## PLAYERS STILL ALIVE
${context.livingPlayers.map((id) => `- ${id}`).join("\n")}

## RECENT GAME HISTORY
${
  context.gameHistory
    .slice(-5)
    .map((msg) => `- ${msg}`)
    .join("\n") || "No recent history"
}`;
  }

  /**
   * Build discussion prompt with rich context
   */
  buildDiscussionPrompt(
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): string {
    const baseContext = this.buildBaseContext(context, personality);

    const roleGuidance = this.getRoleGuidance(context.role, "discussion");
    const personalityGuidance = this.getPersonalityGuidance(
      personality,
      "discussion"
    );

    const previousMessages = temporaryContext.data?.previous_messages || [];
    const discussionContext =
      previousMessages.length > 0
        ? `\n## DISCUSSION SO FAR\n${previousMessages
            .map((msg: string) => `- ${msg}`)
            .join("\n")}`
        : "\n## DISCUSSION SO FAR\nYou are the first to speak.";

    return `${baseContext}

${roleGuidance}

${personalityGuidance}

${discussionContext}

## YOUR TASK
It's your turn to speak in the discussion phase. Share your thoughts, suspicions, or observations.

## RESPONSE FORMAT
Respond with ONLY a JSON object in this exact format:
{
  "message": "Your discussion message here"
}

## GUIDELINES
- Stay in character as ${personality.name}
- Consider your role's objectives
- Reference the discussion if relevant
- Keep message under 100 words
- Be natural and human-like
- Only JSON, no other text`;
  }

  /**
   * Build voting prompt with full discussion context
   */
  buildVotingPrompt(
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): string {
    const baseContext = this.buildBaseContext(context, personality);

    const roleGuidance = this.getRoleGuidance(context.role, "voting");
    const personalityGuidance = this.getPersonalityGuidance(
      personality,
      "voting"
    );

    const fullDiscussion = temporaryContext.data?.full_discussion || [];
    const availableTargets = temporaryContext.data?.available_targets || [];

    const discussionSummary =
      fullDiscussion.length > 0
        ? `\n## COMPLETE DISCUSSION\n${fullDiscussion
            .map((msg: string) => `- ${msg}`)
            .join("\n")}`
        : "\n## COMPLETE DISCUSSION\nNo discussion occurred.";

    const votingInfo = `\n## VOTING INFORMATION
- You can vote for: ${availableTargets.join(", ")}
- Votes cast so far: ${temporaryContext.data?.votes_cast_so_far || 0}/${
      temporaryContext.data?.total_voters || 0
    }
- Time remaining: ${Math.round(
      (temporaryContext.data?.voting_time_remaining || 0) / 1000
    )}s`;

    return `${baseContext}

${roleGuidance}

${personalityGuidance}

${discussionSummary}

${votingInfo}

## YOUR TASK
Based on the complete discussion, choose who to vote to eliminate.

## RESPONSE FORMAT
Respond with ONLY a JSON object in this exact format:
{
  "message": "Brief explanation of your vote",
  "vote_target": "exact_player_name"
}

## GUIDELINES
- vote_target must be exactly one of: ${availableTargets.join(", ")}
- Consider your role's win condition
- Reference the discussion in your reasoning
- Stay in character as ${personality.name}
- Keep message under 50 words
- Only JSON, no other text`;
  }

  /**
   * Build night action prompt with strategic context
   */
  buildNightActionPrompt(
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): string {
    const baseContext = this.buildBaseContext(context, personality);

    const roleGuidance = this.getRoleGuidance(context.role, "night");
    const personalityGuidance = this.getPersonalityGuidance(
      personality,
      "night"
    );

    const availableTargets = temporaryContext.data?.available_targets || [];
    const mafiaChat = temporaryContext.data?.mafia_chat_history || [];

    const actionType =
      context.role === PlayerRole.MAFIA_LEADER ? "kill" : "heal";

    const mafiaContext =
      mafiaChat.length > 0 && context.role.includes("MAFIA")
        ? `\n## MAFIA COORDINATION\n${mafiaChat
            .map((msg: string) => `- ${msg}`)
            .join("\n")}`
        : "";

    const nightInfo = `\n## NIGHT ACTION INFORMATION
- Your action type: ${actionType}
- Available targets: ${availableTargets.join(", ")}
- Round: ${context.round}
- Time remaining: ${Math.round(
      (temporaryContext.data?.time_remaining || 0) / 1000
    )}s`;

    return `${baseContext}

${roleGuidance}

${personalityGuidance}

${mafiaContext}

${nightInfo}

## YOUR TASK
Choose your ${actionType} target for tonight.

## RESPONSE FORMAT
Respond with ONLY a JSON object in this exact format:
{
  "action": "${actionType}",
  "target": "exact_player_name_or_nobody",
  "reasoning": "Brief explanation of your choice"
}

## GUIDELINES
- target must be exactly one of: ${availableTargets.join(", ")} OR "nobody"
- Use "nobody" if you choose not to act
- Consider your role's strategic goals
- Stay in character as ${personality.name}
- Keep reasoning under 30 words
- Only JSON, no other text`;
  }

  /**
   * Get role-specific guidance
   */
  private getRoleGuidance(role: PlayerRole, phase: string): string {
    const guidance = {
      [PlayerRole.MAFIA_LEADER]: {
        discussion: `## ROLE GUIDANCE (MAFIA LEADER)
- Your goal: Eliminate citizens until mafia equals or outnumbers them
- Strategy: Deflect suspicion, blend in, subtly guide discussion away from mafia
- Avoid: Being too aggressive or obvious
- Remember: You know who the other mafia member is`,
        voting: `## ROLE GUIDANCE (MAFIA LEADER)
- Vote strategically to eliminate threats to mafia
- Consider voting with the majority to avoid suspicion
- Protect your mafia partner if possible
- Eliminate strong players who might detect you`,
        night: `## ROLE GUIDANCE (MAFIA LEADER)
- Choose elimination target carefully
- Consider: Who suspects mafia? Who is influential? Who might be the healer?
- Coordinate with your mafia partner
- Think strategically about game progression`,
      },
      [PlayerRole.MAFIA_MEMBER]: {
        discussion: `## ROLE GUIDANCE (MAFIA MEMBER)
- Your goal: Help mafia achieve numerical parity
- Strategy: Support your leader subtly, deflect suspicion from mafia
- Avoid: Being too defensive of your mafia leader
- Remember: Blend in as a concerned citizen`,
        voting: `## ROLE GUIDANCE (MAFIA MEMBER)
- Follow your leader's strategy but don't be obvious
- Vote to eliminate citizens, especially threats
- Consider voting patterns that don't link you to mafia leader
- Help eliminate strong players`,
        night: `## ROLE GUIDANCE (MAFIA MEMBER)
- You don't take night actions, but coordinate with leader
- Provide input on elimination targets
- Consider who might suspect mafia team
- Plan tomorrow's strategy`,
      },
      [PlayerRole.HEALER]: {
        discussion: `## ROLE GUIDANCE (HEALER)
- Your goal: Help eliminate all mafia members
- Strategy: Gather information, identify suspicious players
- Avoid: Revealing your role too early
- Remember: You can protect people at night`,
        voting: `## ROLE GUIDANCE (HEALER)
- Vote to eliminate suspected mafia members
- Pay attention to voting patterns and behavior
- Consider who might be trying to mislead citizens
- Trust your instincts about suspicious behavior`,
        night: `## ROLE GUIDANCE (HEALER)
- Choose protection target carefully
- Consider: Who might mafia target? Who is valuable to citizens?
- You can protect yourself if you feel threatened
- Think about who might be elimination targets`,
      },
      [PlayerRole.CITIZEN]: {
        discussion: `## ROLE GUIDANCE (CITIZEN)
- Your goal: Help identify and eliminate mafia members
- Strategy: Share observations, ask probing questions
- Look for: Inconsistencies, deflection, suspicious voting patterns
- Remember: Work with other citizens to find mafia`,
        voting: `## ROLE GUIDANCE (CITIZEN)
- Vote based on suspicious behavior and discussion
- Consider: Who deflected questions? Who seems to be misleading?
- Pay attention to voting patterns from previous rounds
- Trust your analysis of the discussion`,
        night: `## ROLE GUIDANCE (CITIZEN)
- You don't take night actions
- Use this time to reflect on the day's events
- Consider who might be mafia based on behavior
- Prepare your strategy for tomorrow`,
      },
    };

    return (
      guidance[role]?.[phase as keyof (typeof guidance)[PlayerRole.CITIZEN]] ||
      `## ROLE GUIDANCE\nPlay according to your role's objectives.`
    );
  }

  /**
   * Get personality-specific guidance
   */
  private getPersonalityGuidance(
    personality: AIPersonality,
    phase: string
  ): string {
    const communicationGuidance = this.getCommunicationGuidance(
      personality.communicationStyle
    );
    const strategicGuidance = this.getStrategicGuidance(
      personality.strategicApproach,
      phase
    );

    return `## PERSONALITY GUIDANCE (${personality.name})
${communicationGuidance}
${strategicGuidance}

Archetype: ${personality.archetype}
- ${this.getArchetypeGuidance(personality.archetype)}`;
  }

  private getCommunicationGuidance(style: any): string {
    const guidelines = [];

    if (style.averageMessageLength === "short") {
      guidelines.push("Keep messages concise and to the point");
    } else if (style.averageMessageLength === "long") {
      guidelines.push("Provide detailed explanations and reasoning");
    }

    if (style.formalityLevel === "formal") {
      guidelines.push("Use formal, professional language");
    } else if (style.formalityLevel === "casual") {
      guidelines.push("Use casual, friendly language");
    }

    if (style.emotionalExpression === "high") {
      guidelines.push("Express emotions and reactions clearly");
    } else if (style.emotionalExpression === "low") {
      guidelines.push("Stay objective and analytical");
    }

    if (style.questionFrequency === "high") {
      guidelines.push("Ask probing questions to gather information");
    }

    if (style.logicalReasoning === "high") {
      guidelines.push("Provide clear logical reasoning for your conclusions");
    }

    return guidelines.join("\n- ");
  }

  private getStrategicGuidance(approach: any, phase: string): string {
    const guidelines = [];

    if (approach.riskTolerance === "aggressive") {
      guidelines.push("Take bold actions and make strong accusations");
    } else if (approach.riskTolerance === "conservative") {
      guidelines.push("Be cautious and avoid risky moves");
    }

    if (approach.informationSharing === "open") {
      guidelines.push("Share your observations and reasoning openly");
    } else if (approach.informationSharing === "secretive") {
      guidelines.push("Keep your true thoughts and observations to yourself");
    }

    if (phase === "voting" && approach.votesTiming === "early") {
      guidelines.push("Decide quickly and vote with confidence");
    } else if (phase === "voting" && approach.votesTiming === "late") {
      guidelines.push("Wait to see how others vote before deciding");
    }

    return guidelines.join("\n- ");
  }

  private getArchetypeGuidance(archetype: string): string {
    const archetypeGuidance = {
      analytical_detective:
        "Focus on logical deduction, patterns, and evidence-based reasoning",
      creative_storyteller:
        "Use narrative thinking, consider motivations, and think about the bigger picture",
      direct_analyst:
        "Be straightforward, focus on facts, and make clear statements",
    };

    return (
      archetypeGuidance[archetype as keyof typeof archetypeGuidance] ||
      "Use your unique perspective to contribute to the game"
    );
  }

  /**
   * Build mafia coordination prompt
   */
  buildMafiaCoordinationPrompt(
    context: AIDecisionContext,
    personality: AIPersonality,
    availableTargets: string[]
  ): string {
    const baseContext = this.buildBaseContext(context, personality);

    return `${baseContext}

## MAFIA COORDINATION
You are coordinating with your mafia team to choose tonight's elimination target.

## AVAILABLE TARGETS
${availableTargets.map((target) => `- ${target}`).join("\n")}

## YOUR TASK
Discuss strategy with your mafia team. Share your thoughts on who to eliminate.

## RESPONSE FORMAT
Respond with ONLY a JSON object in this exact format:
{
  "message": "Your strategic thoughts for the mafia team"
}

## GUIDELINES
- This is private mafia communication
- Discuss who you think should be eliminated and why
- Consider threats to the mafia team
- Stay in character as ${personality.name}
- Keep message under 80 words
- Only JSON, no other text`;
  }

  /**
   * Build healer reasoning prompt
   */
  buildHealerReasoningPrompt(
    context: AIDecisionContext,
    personality: AIPersonality,
    availableTargets: string[]
  ): string {
    const baseContext = this.buildBaseContext(context, personality);

    return `${baseContext}

## HEALER STRATEGIC THINKING
You are considering who to protect tonight.

## AVAILABLE TARGETS
${availableTargets.map((target) => `- ${target}`).join("\n")}

## YOUR TASK
Think strategically about who might need protection.

## RESPONSE FORMAT
Respond with ONLY a JSON object in this exact format:
{
  "message": "Your strategic analysis of protection needs"
}

## GUIDELINES
- Consider who mafia might target
- Think about valuable citizens vs likely targets
- Consider protecting yourself if threatened
- Stay in character as ${personality.name}
- Keep message under 80 words
- Only JSON, no other text`;
  }
}

// Export singleton instance
export const promptBuilder = new PromptBuilder();
