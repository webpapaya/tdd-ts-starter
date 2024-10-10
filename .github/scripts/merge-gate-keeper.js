const POLL_INTERVAL_IN_SECONDS = 5
const IN_PROGRESS = "IN_PROGRESS"
const SUCCESS = "SUCCESS"
const FAILURE = "FAILURE"
const CONCLUSIONS = ["queued", "in_progress", "completed"]

const sleep = (duration) => new Promise((resolve) => setTimeout(() => {
  resolve()
}, duration))

module.exports = async (core, github, context, headRef) => {
  const findStatus = (checkRuns) => {
    if (checkRuns.some((check) => check.conclusion === "failure")) {
      return FAILURE
    } else if (checkRuns.every((check) => check.status === "completed")) {
      return SUCCESS
    } else {
      return IN_PROGRESS
    }
  }

  const pipelineStatus = async () => {
    const response = await github.rest.checks.listForRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: headRef
    })

    const checkRuns = response.data.check_runs.filter((checkRun) => checkRun.name !== "merge-gate-keeper")
    const status = findStatus(checkRuns)

    console.groupCollapsed(`Current Status: ${status}`)
    CONCLUSIONS.forEach((conclusion) => {
      console.log(`${conclusion}:`, checkRuns
        .filter((checkRun) => checkRun.status === conclusion)
        .map((checkRun) => checkRun.name)
        .join(", ")
      )
    })
    console.log()
    console.groupEnd()

    return status
  };

  while (true) {
    const status = await pipelineStatus()

    if (status === SUCCESS) {
      return
    }

    if (status === FAILURE) {
      core.setFailed("Some checks didn't succeed.")
      return
    }

    console.log(`Retrying in ${POLL_INTERVAL_IN_SECONDS}s.`)
    await sleep(POLL_INTERVAL_IN_SECONDS * 1000)
  }
}
