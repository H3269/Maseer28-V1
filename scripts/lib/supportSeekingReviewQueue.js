export function getSupportSeekingReviewDays(topicId) {
  const normalizedTopicId = String(topicId || '').toUpperCase();
  if (normalizedTopicId === 'T02') return [24];

  const match = /^T([0-9]{2})$/u.exec(normalizedTopicId);
  const topicNumber = Number(match?.[1]);
  return Number.isInteger(topicNumber) && topicNumber >= 3 && topicNumber <= 34
    ? [12, 18]
    : [];
}
