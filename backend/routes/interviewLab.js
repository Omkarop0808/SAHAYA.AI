import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { readDB, writeDB } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { callGeminiJSON } from '../services/gemini.js';

const router = express.Router();
const DB_NAME = 'interview_sessions';

function getSessions() { return readDB(DB_NAME); }
function saveSessions(list) { writeDB(DB_NAME, list); }
function findSession(id) { return getSessions().find(s => s.id === id) || null; }
function updateSession(id, updates) {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx === -1) return null;
  sessions[idx] = { ...sessions[idx], ...updates };
  saveSessions(sessions);
  return sessions[idx];
}
function durationToQuestionCount(duration) {
  if (duration <= 10) return 5;
  if (duration <= 20) return 10;
  return 15;
}

function buildStartPrompt(config) {
  const { type, difficulty, companyStyle, subject } = config;
  
  if (type === 'Group Discussion') {
    const numParticipants = config.gdParticipants || 4;
    return `You are an AI engine for a realistic Group Discussion simulator.
Generate a compelling, debatable topic and ${numParticipants} distinct participant personas who will discuss it.
The topic should be relevant to modern technology, business, ethics, social issues, or industry challenges. It must have strong arguments on both sides.

Each participant MUST feel like a REAL person — give them Indian names, distinct personalities, and different stances on the topic.
Some should agree, some should disagree, and some should be on the fence.

Output ONLY valid JSON (no markdown):
{
  "topic": "<a clear, debatable discussion topic>",
  "topicContext": "<1-2 sentence background on why this topic matters>",
  "participants": [
    {"name": "<Indian name>", "personality": "<Assertive|Analytical|Diplomatic|Passionate|Calm>", "stance": "<for|against|neutral>", "background": "<brief 1-line description like 'MBA student focused on marketing'>"}
  ],
  "openingStatement": "<The moderator's opening: welcome everyone, state the topic, and explain they have ${config.duration || 10} minutes to discuss. Keep it under 3 sentences.>",
  "firstResponse": {"participantIndex": 0, "text": "<The first participant's opening argument to kick off the discussion. Should be 2-3 sentences, opinionated, and invite debate. Must sound like a real college student, NOT like an AI — use casual but intelligent language.>"}
}`;
  }

  const roleDesc = type === 'Domain-Specific' && subject
    ? `${subject} specialist`
    : subject || 'software engineering';
  return `You are a strict, professional interviewer at a ${companyStyle || 'FAANG-tier'} company conducting a ${type} interview.
The candidate is a ${difficulty || 'Fresher'} level applying for a ${roleDesc} role.
${type === 'Domain-Specific' && subject ? `IMPORTANT: ALL questions MUST be specifically about ${subject}. Ask deep, applied questions covering core concepts, real-world scenarios, problem-solving, and implementation details related to ${subject}. Do NOT ask generic programming or unrelated questions.` : ''}
You must ask questions EXACTLY like those asked in real interviews at Google, Microsoft, Amazon, Meta, and Apple.

Question style requirements:
- For Technical: Ask coding problems (with sample input/output), DS&A questions with diagrams, time/space complexity analysis.
- For System Design: Ask "Design X" questions with ASCII architecture diagrams showing components, databases, load balancers, APIs.
- For Aptitude: Include logical reasoning, pattern recognition, data interpretation with small tables or number sequences.
- For Case Study: Present a real business scenario with data points and metrics.
- For Behavioral: Ask STAR-format situational questions referencing real workplace scenarios.
- For Domain-Specific: Ask deep technical questions about ${subject || 'the candidate\'s domain'} with code examples, diagrams, flowcharts, or circuit diagrams as relevant.

When relevant, include a "visual" field with:
- ASCII diagrams (system architecture, flowcharts, tree/graph structures)
- Code snippets (with line numbers, in the candidate's likely language)
- Data tables (formatted with | separators)
- Mathematical formulas or patterns

Interview style: Direct, no small talk, one focused question at a time.
You are NOT encouraging. You are formal and demanding. Evaluate critically.
NEVER ask generic or textbook-definition questions. Ask applied, scenario-based questions.

Output ONLY valid JSON (no markdown, no code blocks):
{"id":"<uuid>","text":"<question text>","hints":["<optional hint>"],"type":"<behavioral|technical|aptitude|case|system-design|coding>","visual":"<ASCII diagram, code snippet, data table, or empty string if not needed>"}`;
}

function buildAnswerPrompt(session, answerText) {
  const isGD = session.config.type === 'Group Discussion';
  const recentQA = (session.questionsHistory || []).slice(-3).map((qa, i) =>
    `Turn ${i+1}: AI (${qa.question})\nCandidate (${qa.answer || '(skipped)'})\nScore: ${qa.score ?? 'N/A'}`
  ).join('\n\n');
  const weakAreas = (session.questionsHistory || [])
    .filter(qa => (qa.score ?? 10) < 5).map(qa => qa.question).slice(-3);

  if (isGD) {
    // GD uses the /gd-round endpoint now, not /answer. Keep a minimal fallback.
    return `Evaluate the candidate's GD contribution: "${answerText}". Score 1-10 on argumentation.
Output ONLY valid JSON: {"answerScore": <1-10>, "answerQuality": "average", "whatWasMissed": "", "nextQuestion": null, "interimFeedback": ""}`;
  }

  return `You are a strict interviewer at a ${session.config.companyStyle || 'FAANG'} company. The candidate just answered: "${answerText}"

Previous Q&A (last 3):
${recentQA || 'None yet.'}

Weak areas so far: ${weakAreas.length > 0 ? weakAreas.join('; ') : 'None'}
Interview type: ${session.config.type}, Difficulty: ${session.config.difficulty}
Total questions: ${session.totalQuestions}, Current question number: ${(session.questionIndex || 0) + 1}

Evaluate this answer strictly (1-10) and generate the next question.
Rules:
- If answer was wrong/incomplete → probe deeper on the SAME concept with a harder variation.
- If answer was good → escalate to a harder related topic.
- If skipped → score 0, move to a completely new topic.
- Generate questions like REAL Google/Microsoft/Amazon interviews.
- Include ASCII diagrams, code snippets, or data tables in the "visual" field when the question involves system design, coding, data structures, or aptitude.
- NEVER ask generic textbook questions. Ask applied, scenario-based questions.

CODE EVALUATION (if the answer contains code):
- Evaluate the LOGIC and ALGORITHM, NOT syntax perfection. Minor syntax errors are acceptable.
- Check: Is the approach correct? Are edge cases handled? Is the time/space complexity optimal?
- If the logic is correct but syntax has minor issues → score 7-8, note the syntax issues.
- If the logic is partially correct → score 4-6, explain what’s wrong in the algorithm.
- If the logic is fundamentally wrong → score 1-3, explain the correct approach briefly.
- For the next question: if code was submitted, ask a follow-up like "Can you optimize this?" or "What if the input is X?" or move to a new coding problem.
- If the question asked for code but the candidate gave a text explanation → score max 5, note they should have written actual code.

Output ONLY valid JSON (no markdown):
{
  "answerScore": <1-10>,
  "answerQuality": "<excellent|good|average|poor|incorrect>",
  "whatWasMissed": "<key points missed, empty string if correct>",
  "nextQuestion": {"id":"<uuid>","text":"<question>","hints":[],"type":"<behavioral|technical|aptitude|case|system-design|coding>","visual":"<ASCII diagram/code/table or empty string>"},
  "interimFeedback": "<one strict observation>"
}`;
}

function buildGDRoundPrompt(session, userSpeech) {
  const transcript = (session.gdTranscript || []).slice(-12).map(t =>
    `[${t.speaker}]: ${t.text}`
  ).join('\n');
  const participants = (session.gdParticipants || []).map(p =>
    `${p.name} (${p.personality}, ${p.stance})`
  ).join(', ');

  return `You are simulating a realistic Group Discussion. You control multiple participants.
Topic: "${session.gdTopic}"
Participants: ${participants}
The CANDIDATE (real user) is also in this discussion.

Full discussion so far (last 12 messages):
${transcript || '(Discussion just started)'}

${userSpeech ? `The CANDIDATE just said: "${userSpeech}"` : 'The CANDIDATE has not spoken in this round.'}

Generate 1-2 participant responses to continue the discussion naturally.
RULES:
- Each participant must speak like a REAL college student / professional — casual but intelligent. NO AI-like language.
- They should reference what others said, argue, agree partially, bring new angles.
- If the candidate spoke, at least one participant should respond to their point (agree, disagree, or build on it).
- If the candidate was silent, participants continue discussing among themselves to keep the debate lively.
- Keep each response to 2-4 sentences max. Natural conversation length.
- DO NOT repeat points already made. Bring fresh perspectives.
- Use filler words occasionally ("honestly", "look", "I mean", "that's fair but...") to sound human.
- Participants should sometimes address each other by name.

Output ONLY valid JSON (no markdown):
{
  "responses": [
    {"participantName": "<exact name from participant list>", "text": "<their natural response>"}
  ],
  "candidateScore": ${userSpeech ? '<1-10 score for this round based on argument quality, relevance, communication>' : 'null'},
  "candidateFeedback": "${userSpeech ? '<brief internal note on what was good/bad about their contribution>' : ''}"
}`;
}

function buildReportPrompt(session) {
  const isGD = session.config.type === 'Group Discussion';

  if (isGD) {
    const transcript = (session.gdTranscript || []).map(t =>
      `[${t.speaker}${t.isUser ? ' (CANDIDATE)' : ''}]: ${t.text}`
    ).join('\n');
    const userEntries = (session.gdTranscript || []).filter(t => t.isUser);
    const roundScores = (session.gdRoundScores || []).filter(s => s !== null);

    return `You are a strict Group Discussion evaluator. Analyze this completed GD session.
Topic: "${session.gdTopic}"
Duration: ${session.config.duration} minutes
Participants: ${(session.gdParticipants || []).map(p => p.name).join(', ')} + CANDIDATE

FULL TRANSCRIPT:
${transcript}

Candidate spoke ${userEntries.length} times out of ${(session.gdTranscript || []).length} total messages.
Round scores: ${roundScores.length > 0 ? roundScores.join(', ') : 'N/A'}

Generate a comprehensive GD performance report. Be brutally honest.
Rules:
- Score based on: argumentation quality, communication clarity, initiative/leadership, counter-argument ability, knowledge depth
- hiringRecommendation: "Strong GD Performer" if >= 80. "Decent — Needs More Practice" if 60-79. "Weak GD Performance" if < 60.
- Grade: A+ >= 90, A >= 85, B+ >= 75, B >= 65, C+ >= 55, C >= 45, D >= 30, F < 30.
- If candidate barely spoke, penalize heavily on initiative.

Output ONLY valid JSON (no markdown):
{
  "overallScore": <0-100>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "verdict": "<Strong Performance|Good Performance|Needs Improvement|Needs Significant Improvement|Poor Performance>",
  "hiringRecommendation": "<Strong GD Performer|Decent — Needs More Practice|Weak GD Performance>",
  "categoryScores": {
    "argumentation": <0-100>,
    "communication": <0-100>,
    "initiative": <0-100>,
    "counterArguments": <0-100>,
    "knowledgeDepth": <0-100>
  },
  "strengths": ["<strength1>", "<strength2>"],
  "weaknesses": ["<weakness1>", "<weakness2>"],
  "questionsReview": [
    {
      "question": "<key discussion point/moment>",
      "yourAnswer": "<what the candidate said>",
      "correctAnswer": "<what a strong candidate would have said>",
      "score": <1-10>,
      "whatYouMissed": "<missed arguments>",
      "howToImprove": "<improvement tip>"
    }
  ],
  "facialAnalysisSummary": {
    "averageConfidence": <0-100>,
    "eyeContactRating": "<Good|Average|Poor|N/A>",
    "stressPattern": "<description>",
    "bodyLanguageTips": ["<tip1>", "<tip2>"]
  },
  "voiceAnalysisSummary": {
    "averagePace": "<Slow|Normal|Slightly Fast|Fast|N/A>",
    "volumeConsistency": "<Good|Average|Poor|N/A>",
    "pitchStability": "<Stable|Moderate|Unstable|N/A>",
    "voiceTips": ["<tip1>", "<tip2>"]
  },
  "improvementPlan": [
    { "week": 1, "focus": "<focus>", "action": "<action>" },
    { "week": 2, "focus": "<focus>", "action": "<action>" },
    { "week": 3, "focus": "<focus>", "action": "<action>" }
  ],
  "nextInterviewType": "<Technical|HR / Behavioral|Domain-Specific|Mock Placement>"
}`;
  }

  const allQA = (session.questionsHistory || []).map((qa, i) =>
    `Q${i+1}: ${qa.question}\nAnswer: ${qa.answer || '(skipped)'}\nScore: ${qa.score ?? 0}/10\nVoice: vol=${qa.voiceMetrics?.avgVolume ?? 'N/A'}, wps=${qa.voiceMetrics?.wordsPerSecond ?? 'N/A'}\nFace: conf=${qa.facialMetrics?.confidence ?? 'N/A'}, eye=${qa.facialMetrics?.eyeContact ?? 'N/A'}, stress=${qa.facialMetrics?.stress ?? 'N/A'}`
  ).join('\n\n');

  return `You are a strict interview evaluator. Analyze this completed ${session.config.type} session.
Candidate: ${session.config.difficulty} level | Company: ${session.config.companyStyle || 'General'} | Domain: ${session.config.subject || 'General'}

FULL TRANSCRIPT:
${allQA}

Generate a comprehensive JSON report. Be brutally honest. Do NOT sugarcoat.
Rules:
- hiringRecommendation: "Ready for Placement" ONLY if overallScore >= 80. "Almost Ready — Needs Polish" if 60-79. "Not Ready for Placement" if < 60.
- Grade: A+ >= 90, A >= 85, B+ >= 75, B >= 65, C+ >= 55, C >= 45, D >= 30, F < 30.
- Every questionsReview entry MUST include the correct/ideal answer.
- If facial/voice metrics are N/A, note camera/mic was unavailable.

Output ONLY valid JSON (no markdown):
{
  "overallScore": <0-100>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "verdict": "<Strong Performance|Good Performance|Needs Improvement|Needs Significant Improvement|Poor Performance>",
  "hiringRecommendation": "<Ready for Placement|Almost Ready — Needs Polish|Not Ready for Placement>",
  "categoryScores": {
    "technicalKnowledge": <0-100>,
    "communication": <0-100>,
    "confidence": <0-100>,
    "structuredThinking": <0-100>,
    "realtimePerformance": <0-100>
  },
  "strengths": ["<strength1>", "<strength2>"],
  "weaknesses": ["<weakness1>", "<weakness2>"],
  "questionsReview": [
    {
      "question": "<question text>",
      "yourAnswer": "<candidate answer>",
      "correctAnswer": "<ideal answer>",
      "score": <1-10>,
      "whatYouMissed": "<missed points>",
      "howToImprove": "<improvement tip>"
    }
  ],
  "facialAnalysisSummary": {
    "averageConfidence": <0-100>,
    "eyeContactRating": "<Good|Average|Poor|N/A>",
    "stressPattern": "<description>",
    "bodyLanguageTips": ["<tip1>", "<tip2>"]
  },
  "voiceAnalysisSummary": {
    "averagePace": "<Slow|Normal|Slightly Fast|Fast|N/A>",
    "volumeConsistency": "<Good|Average|Poor|N/A>",
    "pitchStability": "<Stable|Moderate|Unstable|N/A>",
    "voiceTips": ["<tip1>", "<tip2>"]
  },
  "improvementPlan": [
    { "week": 1, "focus": "<focus>", "action": "<action>" },
    { "week": 2, "focus": "<focus>", "action": "<action>" },
    { "week": 3, "focus": "<focus>", "action": "<action>" }
  ],
  "nextInterviewType": "<Technical|HR / Behavioral|Domain-Specific|Mock Placement>"
}`;
}

function fallbackQuestion(type) {
  return {
    id: uuidv4(),
    text: type === 'HR / Behavioral'
      ? 'Tell me about yourself and why you are interested in this role.'
      : type === 'Case Study'
      ? 'A startup is losing users at checkout. Walk me through how you would diagnose and fix this.'
      : 'Explain a core concept in your domain and give a real-world application.',
    hints: [],
    type: type === 'HR / Behavioral' ? 'behavioral' : 'technical',
  };
}

/* ── POST /api/interview/start ─────────────────────────────── */
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { type, difficulty, duration, companyStyle, subject, gdParticipants } = req.body;
    if (!type) return res.status(400).json({ error: 'Interview type is required.' });

    const config = {
      type,
      difficulty: difficulty || 'Fresher',
      duration: Number(duration) || 10,
      companyStyle: companyStyle || '',
      subject: subject || '',
      gdParticipants: Number(gdParticipants) || 4,
    };

    /* ── GROUP DISCUSSION branch ── */
    if (type === 'Group Discussion') {
      const systemPrompt = buildStartPrompt(config);
      const userPrompt = `Generate a Group Discussion setup with ${config.gdParticipants} participants for a ${config.duration}-minute session. Make the topic engaging and debatable.`;

      let gdData;
      try {
        gdData = await callGeminiJSON(systemPrompt, userPrompt, 1024);
        if (!gdData?.topic || !Array.isArray(gdData.participants)) throw new Error('Invalid GD response');
      } catch (err) {
        console.error('[interview/start] GD Gemini error, using fallback:', err.message);
        gdData = {
          topic: 'Should AI replace human workers in the next decade?',
          topicContext: 'With rapid advances in AI and automation, industries face a transformation that could displace millions of jobs while creating new ones.',
          participants: [
            { name: 'Arjun', personality: 'Assertive', stance: 'for', background: 'CS student passionate about automation' },
            { name: 'Priya', personality: 'Analytical', stance: 'against', background: 'Economics student concerned about job displacement' },
            { name: 'Rahul', personality: 'Diplomatic', stance: 'neutral', background: 'MBA student focused on business strategy' },
            { name: 'Sneha', personality: 'Passionate', stance: 'against', background: 'Social work student advocating for workers\' rights' },
          ].slice(0, config.gdParticipants),
          openingStatement: `Welcome everyone. Today\'s topic is: "Should AI replace human workers in the next decade?". You have ${config.duration} minutes. Please share your views.`,
          firstResponse: { participantIndex: 0, text: 'Look, I think it\'s inevitable. AI is already doing tasks faster and cheaper than humans. We should embrace it rather than fight it.' },
        };
      }

      const session = {
        id: uuidv4(),
        userId: req.userId,
        config,
        totalQuestions: 0,
        questionIndex: 0,
        questionsHistory: [],
        currentQuestion: null,
        gdTopic: gdData.topic,
        gdTopicContext: gdData.topicContext || '',
        gdParticipants: gdData.participants,
        gdTranscript: [],
        gdRoundScores: [],
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        completedAt: null,
        report: null,
      };

      const sessions = getSessions();
      sessions.push(session);
      saveSessions(sessions);

      return res.json({
        sessionId: session.id,
        gdTopic: gdData.topic,
        gdTopicContext: gdData.topicContext || '',
        gdParticipants: gdData.participants,
        openingStatement: gdData.openingStatement,
        firstResponse: gdData.firstResponse,
      });
    }

    /* ── Standard interview branch ── */
    const totalQuestions = durationToQuestionCount(Number(duration) || 10);

    const systemPrompt = buildStartPrompt(config);
    const userPrompt = `Generate the FIRST question for a ${config.difficulty} ${config.type} interview${config.subject ? ` in ${config.subject}` : ''}${config.companyStyle ? ` targeting ${config.companyStyle} companies` : ''}. This is question 1 of ${totalQuestions}. Be direct and professional.`;

    let question;
    try {
      question = await callGeminiJSON(systemPrompt, userPrompt, 512);
      if (!question?.text) throw new Error('No question text in response');
      if (!question.id) question.id = uuidv4();
      if (!Array.isArray(question.hints)) question.hints = [];
    } catch (err) {
      console.error('[interview/start] Gemini error, using fallback:', err.message);
      question = fallbackQuestion(type);
    }

    const session = {
      id: uuidv4(),
      userId: req.userId,
      config,
      totalQuestions,
      questionIndex: 0,
      questionsHistory: [],
      currentQuestion: question,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      completedAt: null,
      report: null,
    };

    const sessions = getSessions();
    sessions.push(session);
    saveSessions(sessions);

    res.json({ sessionId: session.id, question, totalQuestions });
  } catch (err) {
    console.error('[interview/start] Error:', err);
    res.status(500).json({ error: 'Failed to start interview. Please try again.' });
  }
});

/* ── POST /api/interview/gd-round ──────────────────────────── */
router.post('/gd-round', authMiddleware, async (req, res) => {
  try {
    const { sessionId, userSpeech, facialMetrics } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required.' });

    const session = findSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.userId !== req.userId) return res.status(403).json({ error: 'Unauthorized.' });
    if (session.status !== 'in_progress') return res.status(400).json({ error: 'Session already completed.' });

    // Add user speech to transcript if they spoke
    const updatedTranscript = [...(session.gdTranscript || [])];
    const updatedScores = [...(session.gdRoundScores || [])];

    if (userSpeech && userSpeech.trim()) {
      updatedTranscript.push({
        speaker: 'You',
        text: userSpeech.trim(),
        isUser: true,
        timestamp: new Date().toISOString(),
      });
    }

    const systemPrompt = buildGDRoundPrompt({ ...session, gdTranscript: updatedTranscript }, userSpeech?.trim() || '');
    const userPrompt = 'Continue the group discussion naturally. Generate 1-2 participant responses.';

    let roundData;
    try {
      roundData = await callGeminiJSON(systemPrompt, userPrompt, 1024);
      if (!Array.isArray(roundData?.responses)) throw new Error('Invalid GD round response');
    } catch (err) {
      console.error('[interview/gd-round] Gemini error, using fallback:', err.message);
      const fallbackParticipant = (session.gdParticipants || [{ name: 'Participant' }])[Math.floor(Math.random() * (session.gdParticipants || []).length)];
      roundData = {
        responses: [{ participantName: fallbackParticipant.name, text: 'I think we need to consider both sides of this argument more carefully. What does everyone else think?' }],
        candidateScore: userSpeech ? 5 : null,
        candidateFeedback: '',
      };
    }

    // Add AI participant responses to transcript
    for (const resp of roundData.responses) {
      updatedTranscript.push({
        speaker: resp.participantName,
        text: resp.text,
        isUser: false,
        timestamp: new Date().toISOString(),
      });
    }

    if (roundData.candidateScore != null) {
      updatedScores.push(roundData.candidateScore);
    }

    updateSession(sessionId, {
      gdTranscript: updatedTranscript,
      gdRoundScores: updatedScores,
    });

    res.json({
      responses: roundData.responses,
      candidateScore: roundData.candidateScore,
      candidateFeedback: roundData.candidateFeedback || '',
    });
  } catch (err) {
    console.error('[interview/gd-round] Error:', err);
    res.status(500).json({ error: 'Failed to process GD round.' });
  }
});

/* ── POST /api/interview/answer ────────────────────────────── */
router.post('/answer', authMiddleware, async (req, res) => {
  try {
    const { sessionId, questionId, answerText, answerImageBase64, voiceMetrics, facialMetrics } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required.' });

    const session = findSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.userId !== req.userId) return res.status(403).json({ error: 'Unauthorized.' });
    if (session.status !== 'in_progress') return res.status(400).json({ error: 'Session already completed.' });

    const currentQ = session.currentQuestion;
    let effectiveAnswer = answerText?.trim() || '';
    if (answerImageBase64) {
      effectiveAnswer = effectiveAnswer 
        ? `[Attached Image of Handwritten Answer + Text Note: ${effectiveAnswer}]` 
        : `[Candidate submitted an image of their handwritten answer on paper. Analyze the image.]`;
    } else if (!effectiveAnswer) {
      effectiveAnswer = '(skipped)';
    }

    const isLastQuestion = session.questionIndex >= session.totalQuestions - 1;

    const systemPrompt = buildAnswerPrompt(session, effectiveAnswer);
    const userPrompt = `The current question was: "${currentQ?.text}". Evaluate and ${isLastQuestion ? 'provide final evaluation (set nextQuestion to null)' : 'generate next question'}.`;

    let evaluation;
    try {
      evaluation = await callGeminiJSON(systemPrompt, userPrompt, 1024);
      if (typeof evaluation.answerScore !== 'number') evaluation.answerScore = 5;
      if (!evaluation.nextQuestion?.text && !isLastQuestion) {
        evaluation.nextQuestion = fallbackQuestion(session.config.type);
      }
    } catch (err) {
      console.error('[interview/answer] Gemini error:', err.message);
      evaluation = {
        answerScore: 5,
        answerQuality: 'average',
        whatWasMissed: 'Evaluation unavailable — default score applied.',
        nextQuestion: isLastQuestion ? null : fallbackQuestion(session.config.type),
        interimFeedback: 'Moving to the next question.',
      };
    }

    const qaEntry = {
      questionId: currentQ?.id || uuidv4(),
      question: currentQ?.text || '',
      questionType: currentQ?.type || 'technical',
      answer: effectiveAnswer,
      score: Math.min(10, Math.max(0, evaluation.answerScore)),
      quality: evaluation.answerQuality || 'average',
      whatWasMissed: evaluation.whatWasMissed || '',
      interimFeedback: evaluation.interimFeedback || '',
      voiceMetrics: voiceMetrics || {},
      facialMetrics: facialMetrics || {},
      answeredAt: new Date().toISOString(),
    };

    const updatedHistory = [...(session.questionsHistory || []), qaEntry];
    const newIndex = session.questionIndex + 1;
    const isComplete = newIndex >= session.totalQuestions || isLastQuestion;

    let nextQuestion = null;
    if (!isComplete && evaluation.nextQuestion) {
      nextQuestion = { ...evaluation.nextQuestion, id: evaluation.nextQuestion.id || uuidv4() };
    }

    updateSession(sessionId, {
      questionsHistory: updatedHistory,
      questionIndex: newIndex,
      currentQuestion: nextQuestion,
      status: isComplete ? 'completed' : 'in_progress',
    });

    res.json({
      answerScore: qaEntry.score,
      answerQuality: qaEntry.quality,
      whatWasMissed: qaEntry.whatWasMissed,
      interimFeedback: qaEntry.interimFeedback,
      nextQuestion,
      isComplete,
    });
  } catch (err) {
    console.error('[interview/answer] Error:', err);
    res.status(500).json({ error: 'Failed to process answer.' });
  }
});

/* ── POST /api/interview/finish ────────────────────────────── */
router.post('/finish', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required.' });

    const session = findSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.userId !== req.userId) return res.status(403).json({ error: 'Unauthorized.' });

    // Return cached report if already generated
    if (session.report) return res.json({ report: session.report });

    const systemPrompt = buildReportPrompt(session);
    const userPrompt = 'Generate the comprehensive performance report. Be strict and brutally honest.';

    let report;
    try {
      report = await callGeminiJSON(systemPrompt, userPrompt, 4096);
      // Validate and fill missing fields
      if (typeof report.overallScore !== 'number') {
        const avg = session.questionsHistory.length > 0
          ? Math.round(session.questionsHistory.reduce((s, q) => s + (q.score || 0), 0) / session.questionsHistory.length * 10)
          : 30;
        report.overallScore = avg;
      }
    } catch (err) {
      console.error('[interview/finish] Gemini error, building fallback report:', err.message);
      const scores = session.questionsHistory.map(q => q.score || 0);
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) : 30;
      report = {
        overallScore: avg,
        grade: avg >= 90 ? 'A+' : avg >= 85 ? 'A' : avg >= 75 ? 'B+' : avg >= 65 ? 'B' : avg >= 55 ? 'C+' : avg >= 45 ? 'C' : avg >= 30 ? 'D' : 'F',
        verdict: avg >= 80 ? 'Good Performance' : avg >= 60 ? 'Needs Improvement' : 'Needs Significant Improvement',
        hiringRecommendation: avg >= 80 ? 'Ready for Placement' : avg >= 60 ? 'Almost Ready — Needs Polish' : 'Not Ready for Placement',
        categoryScores: { technicalKnowledge: avg, communication: avg, confidence: avg, structuredThinking: avg, realtimePerformance: avg },
        strengths: ['Completed the interview session', 'Demonstrated willingness to engage'],
        weaknesses: ['Detailed AI analysis unavailable', 'Please review your answers below'],
        questionsReview: session.questionsHistory.map(qa => ({
          question: qa.question,
          yourAnswer: qa.answer,
          correctAnswer: 'AI evaluation temporarily unavailable. Review this topic thoroughly.',
          score: qa.score || 0,
          whatYouMissed: qa.whatWasMissed || '',
          howToImprove: 'Study this topic and practice answering with the STAR method.',
        })),
        facialAnalysisSummary: { averageConfidence: 0, eyeContactRating: 'N/A', stressPattern: 'Camera data unavailable.', bodyLanguageTips: ['Maintain eye contact with the camera', 'Sit upright and smile before answering'] },
        voiceAnalysisSummary: { averagePace: 'N/A', volumeConsistency: 'N/A', pitchStability: 'N/A', voiceTips: ['Speak at 120-140 words per minute', 'Pause 2 seconds before answering to collect thoughts'] },
        improvementPlan: [
          { week: 1, focus: 'Core Fundamentals', action: 'Review core concepts in your domain daily for 30 minutes.' },
          { week: 2, focus: 'Behavioral Questions', action: 'Practice 5 STAR-format answers on paper or with a friend.' },
          { week: 3, focus: 'Mock Practice', action: 'Complete 2 more Interview Lab sessions and compare scores.' },
        ],
        nextInterviewType: 'Technical',
      };
    }

    updateSession(sessionId, { report, status: 'completed', completedAt: new Date().toISOString() });
    res.json({ report });
  } catch (err) {
    console.error('[interview/finish] Error:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

/* ── GET /api/interview/sessions ───────────────────────────── */
router.get('/sessions', authMiddleware, (req, res) => {
  try {
    const sessions = getSessions()
      .filter(s => s.userId === req.userId)
      .map(s => ({
        id: s.id,
        type: s.config?.type,
        difficulty: s.config?.difficulty,
        companyStyle: s.config?.companyStyle,
        duration: s.config?.duration,
        status: s.status,
        totalQuestions: s.totalQuestions,
        answeredCount: (s.questionsHistory || []).length,
        overallScore: s.report?.overallScore ?? null,
        grade: s.report?.grade ?? null,
        hiringRecommendation: s.report?.hiringRecommendation ?? null,
        startedAt: s.startedAt,
        completedAt: s.completedAt ?? null,
        report: s.report,
        config: s.config,
      }))
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    res.json({ sessions });
  } catch (err) {
    console.error('[interview/sessions] Error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions.' });
  }
});

/* ── GET /api/interview/sessions/:id ───────────────────────── */
router.get('/sessions/:id', authMiddleware, (req, res) => {
  try {
    const session = findSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.userId !== req.userId) return res.status(403).json({ error: 'Unauthorized.' });
    res.json({ session });
  } catch (err) {
    console.error('[interview/sessions/:id] Error:', err);
    res.status(500).json({ error: 'Failed to fetch session.' });
  }
});

export default router;
