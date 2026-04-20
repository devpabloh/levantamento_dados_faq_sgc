import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import data from './data/faq.json'
import FloatingChat from './components/FloatingChat'

function normalizeDataFaq(raw){
  const categories = []
  const tags = []
  const questions = []
  const responses = []

  const categoryMap = new Map()
  const tagMap = new Map()

  let id = 1
  const nextid = () => id++

  for(const intent of raw.intents ?? []){
    let categoryId = categoryMap.get(intent.category)

    if(!categoryId){
      categoryId = nextid()
      categoryMap.set(intent.category, categoryId)
      categories.push({id: categoryId, name: intent.category})
    }

    const tagKey = `${categoryId}:${intent.tag}`
    let tagId = tagMap.get(tagKey)
    if(!tagId){
      tagId = nextid()
      tagMap.set(tagKey, tagId)
      tags.push({
        id: tagId, 
        title: intent.tag,
        category_id: categoryId
      })
    }

    for (const pattern of intent.patterns ?? []){
      const questionId = nextid()
      questions.push({
        id: questionId,
        body_questions: pattern,
        tag_id: tagId
      })

      for(const responseText of intent.responses ?? []){
        responses.push({
          id: nextid(),
          body_response: responseText,
          question_id: questionId
        })
      }
    }
  }
  return {categories, tags, questions, responses}
}

const INITIAL_DB = normalizeDataFaq(data)

function makeId() {
  return Date.now() + Math.floor(Math.random() * 1000)
}

function reorderByIds(list, activeId, overId) {
  const oldIndex = list.findIndex((item) => item.id === activeId)
  const newIndex = list.findIndex((item) => item.id === overId)

  if (oldIndex === -1 || newIndex === -1) return list

  return arrayMove(list, oldIndex, newIndex)
}

function reorderByParent(list, parentKey, parentId, activeId, overId) {
  const groupedItems = list.filter((item) => item[parentKey] === parentId)
  const reorderedGroup = reorderByIds(groupedItems, activeId, overId)

  if (groupedItems === reorderedGroup) return list

  let groupIndex = 0
  return list.map((item) => {
    if (item[parentKey] !== parentId) return item
    const nextItem = reorderedGroup[groupIndex]
    groupIndex += 1
    return nextItem
  })
}

function moveItemToParent(list, parentKey, activeId, toParentId, overId = null) {
  const activeIndex = list.findIndex((item) => item.id === activeId)
  if (activeIndex === -1) return list

  const activeItem = { ...list[activeIndex], [parentKey]: toParentId }
  const withoutActive = list.filter((item) => item.id !== activeId)

  let insertIndex = -1
  if (overId !== null) {
    insertIndex = withoutActive.findIndex((item) => item.id === overId)
  }

  if (insertIndex === -1) {
    insertIndex = withoutActive.length
    for (let index = withoutActive.length - 1; index >= 0; index -= 1) {
      if (withoutActive[index][parentKey] === toParentId) {
        insertIndex = index + 1
        break
      }
    }
  }

  const next = [...withoutActive]
  next.splice(insertIndex, 0, activeItem)
  return next
}

export default function App() {
  const [db, setDb] = useState(() => {
    const saved = localStorage.getItem('faq_db')
    return saved ? JSON.parse(saved) : INITIAL_DB
  })

  const [expandedCategories, setExpandedCategories] = useState({})
  const [expandedTags, setExpandedTags] = useState({})
  const [expandedQuestions, setExpandedQuestions] = useState({})

  const [modal, setModal] = useState({
    open: false,
    mode: 'create',
    entity: 'category',
    item: null,
    parentId: null,
  })
  const [inputValue, setInputValue] = useState('')
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    localStorage.setItem('faq_db', JSON.stringify(db))
  }, [db])

  const tagsByCategory = useMemo(() => {
    const map = new Map()
    db.tags.forEach((tag) => {
      if (!map.has(tag.category_id)) map.set(tag.category_id, [])
      map.get(tag.category_id).push(tag)
    })
    return map
  }, [db.tags])

  const questionsByTag = useMemo(() => {
    const map = new Map()
    db.questions.forEach((question) => {
      if (!map.has(question.tag_id)) map.set(question.tag_id, [])
      map.get(question.tag_id).push(question)
    })
    return map
  }, [db.questions])

  const responsesByQuestion = useMemo(() => {
    const map = new Map()
    db.responses.forEach((response) => {
      if (!map.has(response.question_id)) map.set(response.question_id, [])
      map.get(response.question_id).push(response)
    })
    return map
  }, [db.responses])

  function toggleExpanded(kind, id) {
    if (kind === 'category') {
      setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }))
    }
    if (kind === 'tag') {
      setExpandedTags((prev) => ({ ...prev, [id]: !prev[id] }))
    }
    if (kind === 'question') {
      setExpandedQuestions((prev) => ({ ...prev, [id]: !prev[id] }))
    }
  }

  function openModal(mode, entity, item = null, parentId = null) {
    const currentValue = item ? item.name || item.title || item.body_questions : ''
    setInputValue(currentValue)
    setModal({ open: true, mode, entity, item, parentId })
  }

  function closeModal() {
    setModal({ open: false, mode: 'create', entity: 'category', item: null, parentId: null })
    setInputValue('')
  }

  function submitModal(event) {
    event.preventDefault()
    const value = inputValue.trim()
    if (!value) return

    if (modal.mode === 'create') {
      if (modal.entity === 'category') {
        setDb((prev) => ({
          ...prev,
          categories: [...prev.categories, { id: makeId(), name: value }],
        }))
      }

      if (modal.entity === 'tag' && modal.parentId) {
        setDb((prev) => ({
          ...prev,
          tags: [...prev.tags, { id: makeId(), title: value, category_id: modal.parentId }],
        }))
      }

      if (modal.entity === 'question' && modal.parentId) {
        setDb((prev) => ({
          ...prev,
          questions: [...prev.questions, { id: makeId(), body_questions: value, tag_id: modal.parentId }],
        }))
      }
    }

    if (modal.mode === 'edit' && modal.item) {
      if (modal.entity === 'category') {
        setDb((prev) => ({
          ...prev,
          categories: prev.categories.map((item) => (item.id === modal.item.id ? { ...item, name: value } : item)),
        }))
      }

      if (modal.entity === 'tag') {
        setDb((prev) => ({
          ...prev,
          tags: prev.tags.map((item) => (item.id === modal.item.id ? { ...item, title: value } : item)),
        }))
      }

      if (modal.entity === 'question') {
        setDb((prev) => ({
          ...prev,
          questions: prev.questions.map((item) =>
            item.id === modal.item.id ? { ...item, body_questions: value } : item,
          ),
        }))
      }
    }

    closeModal()
  }

  function deleteCategory(categoryId) {
    const tagIds = db.tags.filter((tag) => tag.category_id === categoryId).map((tag) => tag.id)
    const questionIds = db.questions.filter((question) => tagIds.includes(question.tag_id)).map((question) => question.id)

    setDb((prev) => ({
      categories: prev.categories.filter((item) => item.id !== categoryId),
      tags: prev.tags.filter((item) => item.category_id !== categoryId),
      questions: prev.questions.filter((item) => !tagIds.includes(item.tag_id)),
      responses: prev.responses.filter((item) => !questionIds.includes(item.question_id)),
    }))
  }

  function deleteTag(tagId) {
    const questionIds = db.questions.filter((question) => question.tag_id === tagId).map((question) => question.id)

    setDb((prev) => ({
      ...prev,
      tags: prev.tags.filter((item) => item.id !== tagId),
      questions: prev.questions.filter((item) => item.tag_id !== tagId),
      responses: prev.responses.filter((item) => !questionIds.includes(item.question_id)),
    }))
  }

  function deleteQuestion(questionId) {
    setDb((prev) => ({
      ...prev,
      questions: prev.questions.filter((item) => item.id !== questionId),
      responses: prev.responses.filter((item) => item.question_id !== questionId),
    }))
  }

  function upsertResponse(questionId, responseId, bodyText) {
    const value = bodyText.trim()
    if (!value) return

    setDb((prev) => {
      if (responseId) {
        return {
          ...prev,
          responses: prev.responses.map((item) =>
            item.id === responseId ? { ...item, body_response: value } : item,
          ),
        }
      }

      return {
        ...prev,
        responses: [...prev.responses, { id: makeId(), body_response: value, question_id: questionId }],
      }
    })
  }

  function deleteResponse(responseId) {
    setDb((prev) => ({
      ...prev,
      responses: prev.responses.filter((item) => item.id !== responseId),
    }))
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    if (!activeData || !overData || activeData.entity !== overData.entity) return

    setDb((prev) => {
      if (activeData.entity === 'category') {
        if (activeData.itemId === overData.itemId) return prev

        return {
          ...prev,
          categories: reorderByIds(prev.categories, activeData.itemId, overData.itemId),
        }
      }

      if (activeData.entity === 'tag') {
        const overItemId = overData.kind === 'item' ? overData.itemId : null
        const sameParent = activeData.parentId === overData.parentId

        return {
          ...prev,
          tags: sameParent
            ? overItemId === null || activeData.itemId === overItemId
              ? prev.tags
              : reorderByParent(prev.tags, 'category_id', activeData.parentId, activeData.itemId, overItemId)
            : moveItemToParent(prev.tags, 'category_id', activeData.itemId, overData.parentId, overItemId),
        }
      }

      if (activeData.entity === 'question') {
        const overItemId = overData.kind === 'item' ? overData.itemId : null
        const sameParent = activeData.parentId === overData.parentId

        return {
          ...prev,
          questions: sameParent
            ? overItemId === null || activeData.itemId === overItemId
              ? prev.questions
              : reorderByParent(prev.questions, 'tag_id', activeData.parentId, activeData.itemId, overItemId)
            : moveItemToParent(prev.questions, 'tag_id', activeData.itemId, overData.parentId, overItemId),
        }
      }

      if (activeData.entity === 'response') {
        const overItemId = overData.kind === 'item' ? overData.itemId : null
        const sameParent = activeData.parentId === overData.parentId

        return {
          ...prev,
          responses: sameParent
            ? overItemId === null || activeData.itemId === overItemId
              ? prev.responses
              : reorderByParent(prev.responses, 'question_id', activeData.parentId, activeData.itemId, overItemId)
            : moveItemToParent(prev.responses, 'question_id', activeData.itemId, overData.parentId, overItemId),
        }
      }

      return prev
    })
  }

  const modalLabel =
    modal.entity === 'category' ? 'Categoria' : modal.entity === 'tag' ? 'Tag' : 'Pergunta'

  async function sendJsonToFlowPowerAutomateFlow(){
    const flowUrl = import.meta.env.VITE_FLOW_URL
    if (!flowUrl) {
      throw new Error('VITE_FLOW_URL nao configurada no arquivo .env')
    }

    const payloadObject = {
      source: "faq-manager",
      version: 1,
      data: db
    }

    const jsonString = JSON.stringify(payloadObject, null,2)
    const contentBase64 = btoa(unescape(encodeURIComponent(jsonString)))

    const body = {
      fileName: `faq-update-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      contentBase64,
      editor: 'usuario_x',
      sentAt: new Date().toISOString(),
    }

    const res = await fetch(flowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if(!res.ok){
      const text = await res.text()
      throw new Error(`Flow error ${res.status}: ${text}`)
    }

    console.log('Dados enviados com sucesso')
  }

  async function handleConfirmSend() {
    try {
      setIsSending(true)
      setSendError('')
      await sendJsonToFlowPowerAutomateFlow()
      setIsSendModalOpen(false)
    } catch (error) {
      setSendError(error?.message || 'Erro ao enviar dados para o Flow')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold md:text-3xl">Gerenciador de FAQ</h1>
          <p className="text-sm text-slate-400 md:text-base">
            Navegacao em arvore: categoria abre tags, tag abre perguntas, pergunta abre respostas.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold md:text-xl">Categorias</h2>
            <button
              onClick={() => openModal('create', 'category')}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
            >
              <Plus size={16} /> Nova categoria
            </button>
          </div>

          {db.categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
              Nenhuma categoria cadastrada.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={db.categories.map((category) => `category:${category.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {db.categories.map((category) => {
                    const tags = tagsByCategory.get(category.id) || []
                    const isCategoryOpen = Boolean(expandedCategories[category.id])

                    return (
                      <SortableContainer
                        key={category.id}
                        id={`category:${category.id}`}
                        data={{ kind: 'item', entity: 'category', itemId: category.id, parentId: null }}
                      >
                        {({ dragAttributes, dragListeners }) => (
                          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <RowHeader
                              label={category.name}
                              isOpen={isCategoryOpen}
                              count={tags.length}
                              countLabel="tags"
                              onToggle={() => toggleExpanded('category', category.id)}
                              onEdit={() => openModal('edit', 'category', category)}
                              onDelete={() => deleteCategory(category.id)}
                              dragAttributes={dragAttributes}
                              dragListeners={dragListeners}
                            />

                            {isCategoryOpen && (
                              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                                <div className="mb-3 flex items-center justify-between">
                                  <h3 className="text-sm font-semibold text-slate-300">Tags da categoria</h3>
                                  <button
                                    onClick={() => openModal('create', 'tag', null, category.id)}
                                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-500"
                                  >
                                    <Plus size={14} /> Nova tag
                                  </button>
                                </div>

                                <SortableContext
                                  items={tags.map((tag) => `tag:${tag.id}`)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-2">
                                    {tags.length === 0 && <p className="text-sm text-slate-500">Nenhuma tag para esta categoria.</p>}
                                    {tags.map((tag) => {
                                      const questions = questionsByTag.get(tag.id) || []
                                      const isTagOpen = Boolean(expandedTags[tag.id])

                                      return (
                                        <SortableContainer
                                          key={tag.id}
                                          id={`tag:${tag.id}`}
                                          data={{ kind: 'item', entity: 'tag', itemId: tag.id, parentId: tag.category_id }}
                                        >
                                          {({ dragAttributes, dragListeners }) => (
                                            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                                              <RowHeader
                                                label={tag.title}
                                                isOpen={isTagOpen}
                                                count={questions.length}
                                                countLabel="perguntas"
                                                onToggle={() => toggleExpanded('tag', tag.id)}
                                                onEdit={() => openModal('edit', 'tag', tag)}
                                                onDelete={() => deleteTag(tag.id)}
                                                dragAttributes={dragAttributes}
                                                dragListeners={dragListeners}
                                              />

                                              {isTagOpen && (
                                                <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/50 p-3">
                                                  <div className="mb-3 flex items-center justify-between">
                                                    <h4 className="text-sm font-semibold text-slate-300">Perguntas da tag</h4>
                                                    <button
                                                      onClick={() => openModal('create', 'question', null, tag.id)}
                                                      className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-500"
                                                    >
                                                      <Plus size={14} /> Nova pergunta
                                                    </button>
                                                  </div>

                                                  <SortableContext
                                                    items={questions.map((question) => `question:${question.id}`)}
                                                    strategy={verticalListSortingStrategy}
                                                  >
                                                    <div className="space-y-2">
                                                      {questions.length === 0 && (
                                                        <p className="text-sm text-slate-500">Nenhuma pergunta para esta tag.</p>
                                                      )}
                                                      {questions.map((question) => {
                                                        const responses = responsesByQuestion.get(question.id) || []
                                                        const isQuestionOpen = Boolean(expandedQuestions[question.id])

                                                        return (
                                                          <SortableContainer
                                                            key={question.id}
                                                            id={`question:${question.id}`}
                                                            data={{
                                                              kind: 'item',
                                                              entity: 'question',
                                                              itemId: question.id,
                                                              parentId: question.tag_id,
                                                            }}
                                                          >
                                                            {({ dragAttributes, dragListeners }) => (
                                                              <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                                                                <RowHeader
                                                                  label={question.body_questions}
                                                                  isOpen={isQuestionOpen}
                                                                  count={responses.length}
                                                                  countLabel="respostas"
                                                                  onToggle={() => toggleExpanded('question', question.id)}
                                                                  onEdit={() => openModal('edit', 'question', question)}
                                                                  onDelete={() => deleteQuestion(question.id)}
                                                                  dragAttributes={dragAttributes}
                                                                  dragListeners={dragListeners}
                                                                />

                                                                {isQuestionOpen && (
                                                                  <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/40 p-3">
                                                                    <ResponseSection
                                                                      questionId={question.id}
                                                                      responses={responses}
                                                                      onSave={upsertResponse}
                                                                      onDelete={deleteResponse}
                                                                    />
                                                                  </div>
                                                                )}
                                                              </div>
                                                            )}
                                                          </SortableContainer>
                                                        )
                                                      })}
                                                      <DropZone id={`question-drop:${tag.id}`} entity="question" parentId={tag.id} />
                                                    </div>
                                                  </SortableContext>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </SortableContainer>
                                      )
                                    })}
                                    <DropZone id={`tag-drop:${category.id}`} entity="tag" parentId={category.id} />
                                  </div>
                                </SortableContext>
                              </div>
                            )}
                          </div>
                        )}
                      </SortableContainer>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <FloatingChat/>
        </section>
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {modal.mode === 'create' ? `Nova ${modalLabel}` : `Editar ${modalLabel}`}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <form className="space-y-4" onSubmit={submitModal}>
              <input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-indigo-400"
                placeholder={`Digite ${modalLabel.toLowerCase()}...`}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold hover:bg-indigo-500"
                >
                  Confirmar
                </button>
              </div>
              
            </form>
            
          </div>
        </div>
      )}
      <div className='flex items-center justify-center mt-4'>
        <button onClick={() => setIsSendModalOpen(true)} 
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 hover:cursor-pointer">Enviar informações</button>
      </div>

      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white">Confirmar envio</h3>
            <p className="mt-2 text-sm text-slate-300">
              Deseja enviar as informacoes atuais em JSON para o Power Automate Flow?
            </p>

            {sendError && <p className="mt-3 text-sm text-rose-400">{sendError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSendModalOpen(false)}
                disabled={isSending}
                className="rounded-lg bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={isSending}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSending ? 'Enviando...' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RowHeader({
  label,
  isOpen,
  count,
  countLabel,
  onToggle,
  onEdit,
  onDelete,
  dragAttributes,
  dragListeners,
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <button onClick={onToggle} className="flex flex-1 items-start gap-2 text-left hover:text-indigo-300">
        {isOpen ? <ChevronDown size={16} className="mt-1" /> : <ChevronRight size={16} className="mt-1" />}
        <div>
          <p className="text-sm text-slate-100 md:text-base">{label}</p>
          <p className="text-xs text-slate-500">
            {count} {countLabel}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          {...dragAttributes}
          {...dragListeners}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          title="Arrastar para reordenar"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical size={14} />
        </button>
        <button
          onClick={onEdit}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-indigo-300"
          title="Editar"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
          title="Excluir"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function ResponseSection({ questionId, responses, onSave, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [text, setText] = useState('')

  function handleSave() {
    onSave(questionId, editingId, text)
    setEditingId(null)
    setText('')
  }

  function handleEdit(response) {
    setEditingId(response.id)
    setText(response.body_response)
  }

  function handleNew() {
    setEditingId(null)
    setText('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-slate-300">Respostas da pergunta</h5>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-500"
        >
          <Plus size={14} /> Nova resposta
        </button>
      </div>

      <SortableContext items={responses.map((response) => `response:${response.id}`)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {responses.length === 0 && <p className="text-sm text-slate-500">Nenhuma resposta cadastrada.</p>}
          {responses.map((response, index) => (
            <SortableContainer
              key={response.id}
              id={`response:${response.id}`}
              data={{ kind: 'item', entity: 'response', itemId: response.id, parentId: response.question_id }}
            >
              {({ dragAttributes, dragListeners }) => (
                <div className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="line-clamp-2 flex-1 text-sm text-slate-300">
                    {index + 1}. {response.body_response}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      {...dragAttributes}
                      {...dragListeners}
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      title="Arrastar resposta"
                      aria-label="Arrastar resposta"
                    >
                      <GripVertical size={14} />
                    </button>
                    <button
                      onClick={() => handleEdit(response)}
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-indigo-300"
                      title="Editar resposta"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(response.id)}
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                      title="Excluir resposta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </SortableContainer>
          ))}
          <DropZone id={`response-drop:${questionId}`} entity="response" parentId={questionId} compact />
        </div>
      </SortableContext>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        className="w-full rounded-md border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-indigo-400"
        placeholder="Digite a resposta..."
      />

      <button
        onClick={handleSave}
        className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500"
      >
        <Save size={14} /> {editingId ? 'Atualizar resposta' : 'Adicionar resposta'}
      </button>
    </div>
  )
}

function SortableContainer({ id, data, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragAttributes: attributes, dragListeners: listeners })}
    </div>
  )
}

function DropZone({ id, entity, parentId, compact = false }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { kind: 'container', entity, parentId } })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border border-dashed px-3 text-center text-xs transition-colors ${
        compact ? 'py-2' : 'py-3'
      } ${isOver ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200' : 'border-slate-700 text-slate-500'}`}
    >
      Solte aqui para mover
    </div>
  )
}
