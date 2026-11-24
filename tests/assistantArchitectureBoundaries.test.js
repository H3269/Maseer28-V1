import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('daily domain orchestration is isolated from generic page routing', async () => {
  const [pageRouter, dailyTurn] = await Promise.all([
    read('../src/features/assistant/pageAssistantTurn.js'),
    read('../src/features/assistant/dailyAssistantTurn.js'),
  ]);
  assert.match(pageRouter, /return makeDailyAssistantTurn\(/);
  assert.doesNotMatch(pageRouter, /buildPreparedDailyAssistantAnswer|makeDailyExerciseGuidanceTurn|getDailySafetyMode/);
  assert.match(dailyTurn, /resolveDailyAssistantContext\(dailyContext\)/);
  assert.match(dailyTurn, /daily_guidance_available/);
  assert.match(dailyTurn, /SAFETY_STATUSES\.has\(inputProbe\.status\)/);
});

test('launcher delegates transcript rendering and typewriter lifecycle', async () => {
  const [launcher, transcript, typewriter] = await Promise.all([
    read('../src/features/assistant/GlobalAssistantLauncher.jsx'),
    read('../src/features/assistant/AssistantTranscript.jsx'),
    read('../src/features/assistant/useAssistantTypewriter.js'),
  ]);
  assert.match(launcher, /useAssistantTypewriter\(messages, sending\)/);
  assert.match(launcher, /<AssistantTranscript messages=\{messages\} sending=\{sending\}/);
  assert.match(transcript, /function AssistantTranscript\(\{ messages, sending, typingProgress, latestAssistantRef \}\)/);
  assert.doesNotMatch(launcher, /const words = revealText\.match\(/);
  assert.doesNotMatch(launcher, /className="assistantTranscript"/);
  assert.match(transcript, /className="assistantTranscript"/);
  assert.match(typewriter, /window\.clearInterval\(timer\)/);
  assert.match(typewriter, /resetTypingProgress/);
});


test('T31 keeps its daily catalogue available while restricting only unsafe interpersonal actions', async () => {
  const [dailyTurn, launcher, engine] = await Promise.all([
    read('../src/features/assistant/dailyAssistantTurn.js'),
    read('../src/features/assistant/GlobalAssistantLauncher.jsx'),
    read('../src/features/assistant/sharedDailyAssistantEngine.js'),
  ]);
  assert.match(dailyTurn, /preparedTopicId !== 'T31'/);
  assert.match(dailyTurn, /relationship_safety_gate_restriction/);
  assert.match(launcher, /activeDailyTopicId !== 'T31' && extendedRelationshipGatePending/);
  assert.match(engine, /relationshipSafetyGateRestriction && relationshipActionQuestion/);
});

test('daily content provenance and safety presentation do not depend on animation', async () => {
  const [context, transcript] = await Promise.all([
    read('../src/features/assistant/dailyAssistantContext.js'),
    read('../src/features/assistant/AssistantTranscript.jsx'),
  ]);
  assert.match(context, /sourceExercise: source\.exercise/);
  assert.match(context, /exerciseExample: source\.exerciseExample/);
  assert.match(context, /actionExample: source\.actionExample/);
  assert.match(context, /guidanceMatchesSource/);
  assert.match(transcript, /item\.dailySafetyReminder && !isLatestAssistantTyping && \(/);
  assert.match(transcript, /revealNotInitialized/);
  assert.doesNotMatch(transcript, /dailySafetyReminder && \(!typingProgress/);
});
