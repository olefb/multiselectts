import { useEffect, useMemo, useState } from 'react'
import { VirtualizedExplorer } from './components/VirtualizedExplorer'
import { ExperimenterBar } from './components/ExperimenterBar'
import { MODEL_LABELS, engineFactory, isSelectionModel, type SelectionModelName } from './lib/engines'
import { DATASETS, datasetOrMock } from './data/datasets'
import { usePreloadedThumbnails } from './hooks/usePreloadedThumbnails'
import { TaskPanel } from './components/TaskPanel'
import type { TaskScore } from './data/tasks'
import { TelemetryContext } from './telemetry/context'
import { TelemetryRecorder } from './telemetry/recorder'

// URL parameters:
//   ?model=algebraic | windows | mac   selection model (study condition)
//   ?dataset=mock | <task folder id>    file tree (src/data/datasets/*.json)
//   ?task=<task id>                     task of that dataset (start view, pre-selection, markers)
//   ?undo=0                             no undo/redo in the algebraic model
//   ?aids=0                             no "Show Selected Only", "(N not visible)" or folder badges
//   ?seed=<n>                           seed of the mock tree
//   ?locked=1                           hide the experimenter bar
//   ?study=1                            study mode for participants (see src/study/StudyApp.tsx)
const params = new URLSearchParams(window.location.search)
const initialModel: SelectionModelName = isSelectionModel(params.get('model')) ? (params.get('model') as SelectionModelName) : 'algebraic'
const initialDataset = datasetOrMock(params.get('dataset'))
const initialTaskId = initialDataset.tasks.has(params.get('task') ?? '') ? params.get('task') : null
const barHidden = params.get('locked') === '1'

/** Keep the URL in sync so a reload (or a copied study link) shows the same thing. */
const setUrlParam = (key: string, value: string | null) => {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  window.history.replaceState(null, '', url)
}

function App() {
  const [model, setModel] = useState<SelectionModelName>(initialModel)
  const [datasetId, setDatasetId] = useState(initialDataset.id)
  const [taskId, setTaskId] = useState<string | null>(initialTaskId)
  const [undo, setUndo] = useState(params.get('undo') !== '0')
  const [aids, setAids] = useState(params.get('aids') !== '0')

  const dataset = datasetOrMock(datasetId)
  const task = taskId ? dataset.tasks.get(taskId) : undefined
  const createEngine = useMemo(() => engineFactory<string, { x: number; y: number }>(model, { undo }), [model, undo])
  const ready = usePreloadedThumbnails(dataset)

  // One telemetry session per page load, saved to study-data/dev/ (study mode: src/study/StudyApp.tsx).
  const [recorder] = useState(
    () => new TelemetryRecorder({ endpoint: `${import.meta.env.BASE_URL}__telemetry/dev/` }),
  )
  useEffect(() => recorder.attach(), [recorder])
  const [score, setScore] = useState<TaskScore | null>(null)
  const [run, setRun] = useState(0) // bumped by "Restart task"
  useEffect(() => {
    if (ready) recorder.enterContext({ model, dataset: dataset.id, undo, aids }, task)
  }, [ready, recorder, model, dataset, undo, aids, task, run])

  return (
    <TelemetryContext.Provider value={recorder}>
      <div className="App">
        {!barHidden && (
          <ExperimenterBar
            model={model}
            onModelChange={(m) => {
              setModel(m)
              setUrlParam('model', m)
            }}
            datasets={[...DATASETS.values()]}
            dataset={dataset}
            onDatasetChange={(id) => {
              setDatasetId(id)
              setTaskId(null) // tasks belong to a dataset
              setScore(null)
              setUrlParam('dataset', id)
              setUrlParam('task', null)
            }}
            taskId={taskId}
            onTaskChange={(id) => {
              setTaskId(id)
              setScore(null)
              setUrlParam('task', id)
            }}
            undo={undo}
            onUndoChange={(on) => {
              setUndo(on)
              setUrlParam('undo', on ? null : '0')
            }}
            aids={aids}
            onAidsChange={(on) => {
              setAids(on)
              setUrlParam('aids', on ? null : '0')
            }}
            recorder={recorder}
          />
        )}
        {task && (
          <TaskPanel
            task={task}
            score={score}
            onDone={() => setScore(recorder.endTask('done'))}
            onRestart={() => {
              setScore(null)
              setRun((r) => r + 1)
            }}
          />
        )}
        {ready ? (
          // key: a new model, dataset, task, setting or restart gets a fresh explorer
          <VirtualizedExplorer
            key={`${model}:${dataset.id}:${task?.id ?? '-'}:${undo}:${aids}:${run}`}
            createEngine={createEngine}
            modelLabel={MODEL_LABELS[model]}
            dataset={dataset}
            task={task}
            selectionAids={aids}
          />
        ) : (
          <p style={{ textAlign: 'center', fontFamily: 'system-ui, sans-serif', color: '#999' }}>Loading images…</p>
        )}
      </div>
    </TelemetryContext.Provider>
  )
}

export default App
