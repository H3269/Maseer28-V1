import fs from 'node:fs';

export function getLatestValidationRun(runs, expectedSha) {
  const matching = runs.filter((run) =>
    run.head_sha === expectedSha
    && run.head_branch === 'main'
    && run.event === 'push'
  );

  if (!matching.length) return null;

  return matching.reduce((latest, candidate) => {
    const candidateKey = [candidate.created_at || '', Number(candidate.run_attempt) || 0];
    const latestKey = [latest.created_at || '', Number(latest.run_attempt) || 0];
    const comparison = candidateKey[0].localeCompare(latestKey[0])
      || candidateKey[1] - latestKey[1];
    return comparison > 0 ? candidate : latest;
  });
}

function main() {
  const reportPath = process.argv[2];
  const expectedSha = process.env.GITHUB_SHA;
  if (!reportPath || !expectedSha) {
    throw new Error('مسیر گزارش اعتبارسنجی و GITHUB_SHA الزامی است.');
  }

  const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const latest = getLatestValidationRun(data.workflow_runs || [], expectedSha);
  if (!latest) {
    throw new Error(`انتشار متوقف شد: اجرای اعتبارسنجی برای commit ${expectedSha} پیدا نشد.`);
  }

  if (latest.status !== 'completed' || latest.conclusion !== 'success') {
    throw new Error(
      `انتشار متوقف شد: آخرین اعتبارسنجی commit ${expectedSha} موفق نیست `
      + `(status=${latest.status}, conclusion=${latest.conclusion}).`,
    );
  }

  console.log(`آخرین اعتبارسنجی با موفقیت انجام شده است: ${latest.id} — ${expectedSha}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
