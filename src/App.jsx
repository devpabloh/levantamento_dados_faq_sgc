import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import data from './data/faq.json'
import ChatWidget from './components/ChatWidget' 
import FloatingChat from './components/FloatingChat'

function normalizeDataFaq(raw){
  const categories = []
  const tags = []
  const questions = []
  const responses = []

  const categoryMap = new Map()
  const tagMap = new Map()

  const tagCountByCategory = new Map() 
  const questionCountByTag = new Map()

  let id = 1
  const nextid = () => id++

  for(const intent of raw.intents ?? []){
    let categoryId = categoryMap.get(intent.category)

    if(!categoryId){
      categoryId = nextid()
      categoryMap.set(intent.category, categoryId)
      categories.push({
        id: categoryId, 
        name: intent.category,
        position: categories.length
      })
    }

    const tagKey = `${categoryId}:${intent.tag}`
    let tagId = tagMap.get(tagKey)
    
    if(!tagId){

      tagId = nextid()
      tagMap.set(tagKey, tagId)

      const tagPosition = tagCountByCategory.get(categoryId) ?? 0 
      tagCountByCategory.set(categoryId,tagPosition + 1)

      tags.push({
        id: tagId, 
        title: intent.tag,
        category_id: categoryId,
        position: tagPosition,
      })
    }

    for (const pattern of intent.patterns ?? []){
      const questionId = nextid()

      const questionPosition = questionCountByTag.get(tagId) ?? 0
      questionCountByTag.set(tagId, questionPosition + 1)

      questions.push({
        id: questionId,
        body_questions: pattern,
        tag_id: tagId,
        position: questionCountByTag
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
  const [searchTerm, setSearchTerm] = useState('')
  const [draggedItem, setDraggedItem] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

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

  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const hasSearch = normalizedSearchTerm.length > 0

  const visibleBySearch = useMemo(() => {
    if (!hasSearch) return null

    const visible = {
      categories: new Set(),
      tags: new Set(),
      questions: new Set(),
      responses: new Set(),
    }

    const tagsByCategoryId = new Map()
    const questionsByTagId = new Map()
    const responsesByQuestionId = new Map()
    const tagsById = new Map()
    const questionsById = new Map()

    db.tags.forEach((tag) => {
      tagsById.set(tag.id, tag)
      if (!tagsByCategoryId.has(tag.category_id)) tagsByCategoryId.set(tag.category_id, [])
      tagsByCategoryId.get(tag.category_id).push(tag)
    })

    db.questions.forEach((question) => {
      questionsById.set(question.id, question)
      if (!questionsByTagId.has(question.tag_id)) questionsByTagId.set(question.tag_id, [])
      questionsByTagId.get(question.tag_id).push(question)
    })

    db.responses.forEach((response) => {
      if (!responsesByQuestionId.has(response.question_id)) responsesByQuestionId.set(response.question_id, [])
      responsesByQuestionId.get(response.question_id).push(response)
    })

    function includeQuestionDeep(questionId) {
      visible.questions.add(questionId)
      const question = questionsById.get(questionId)
      if (!question) return

      visible.tags.add(question.tag_id)
      const tag = tagsById.get(question.tag_id)
      if (tag) visible.categories.add(tag.category_id)

      const responses = responsesByQuestionId.get(questionId) || []
      responses.forEach((response) => visible.responses.add(response.id))
    }

    function includeTagDeep(tagId) {
      visible.tags.add(tagId)
      const tag = tagsById.get(tagId)
      if (!tag) return

      visible.categories.add(tag.category_id)
      const questions = questionsByTagId.get(tagId) || []
      questions.forEach((question) => includeQuestionDeep(question.id))
    }

    function includeCategoryDeep(categoryId) {
      visible.categories.add(categoryId)
      const tags = tagsByCategoryId.get(categoryId) || []
      tags.forEach((tag) => includeTagDeep(tag.id))
    }

    db.categories.forEach((category) => {
      if ((category.name ?? '').toLowerCase().includes(normalizedSearchTerm)) {
        includeCategoryDeep(category.id)
      }
    })

    db.tags.forEach((tag) => {
      if ((tag.title ?? '').toLowerCase().includes(normalizedSearchTerm)) {
        includeTagDeep(tag.id)
      }
    })

    db.questions.forEach((question) => {
      if ((question.body_questions ?? '').toLowerCase().includes(normalizedSearchTerm)) {
        includeQuestionDeep(question.id)
      }
    })

    db.responses.forEach((response) => {
      if ((response.body_response ?? '').toLowerCase().includes(normalizedSearchTerm)) {
        visible.responses.add(response.id)

        const question = questionsById.get(response.question_id)
        if (!question) return

        visible.questions.add(question.id)
        const tag = tagsById.get(question.tag_id)
        if (!tag) return

        visible.tags.add(tag.id)
        visible.categories.add(tag.category_id)
      }
    })

    return visible
  }, [db, hasSearch, normalizedSearchTerm])

  const categoriesToRender = useMemo(() => {
    if (!hasSearch) return db.categories
    return db.categories.filter((category) => visibleBySearch?.categories.has(category.id))
  }, [db.categories, hasSearch, visibleBySearch])

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

  function moveItemBefore(list, sourceId, targetId, transform) {
    if (sourceId === targetId) return list

    const sourceIndex = list.findIndex((item) => item.id === sourceId)
    const targetIndex = list.findIndex((item) => item.id === targetId)
    if (sourceIndex === -1 || targetIndex === -1) return list

    const next = [...list]
    const [moved] = next.splice(sourceIndex, 1)
    const targetItem = next.find((item) => item.id === targetId)
    const updated = transform ? transform(moved, targetItem) : moved
    const insertAt = next.findIndex((item) => item.id === targetId)

    next.splice(insertAt === -1 ? next.length : insertAt, 0, updated)
    return next
  }

  function moveItemToParentEnd(list, sourceId, parentField, targetParentId) {
    const sourceIndex = list.findIndex((item) => item.id === sourceId)
    if (sourceIndex === -1) return list

    const next = [...list]
    const [moved] = next.splice(sourceIndex, 1)
    const updated = { ...moved, [parentField]: targetParentId }

    let insertAt = -1
    next.forEach((item, index) => {
      if (item[parentField] === targetParentId) insertAt = index + 1
    })

    if (insertAt === -1) insertAt = next.length
    next.splice(insertAt, 0, updated)
    return next
  }

  function isValidDropZone(source, targetEntity, targetId) {
    if (!source) return false
    if (source.entity === 'tag' && targetEntity === 'category') return source.parentId !== targetId
    if (source.entity === 'question' && targetEntity === 'tag') return source.parentId !== targetId
    if (source.entity === 'response' && targetEntity === 'question') return source.parentId !== targetId
    return false
  }

  function isValidItemDrop(source, targetEntity, targetId) {
    if (!source) return false
    if (source.entity !== targetEntity) return false
    return source.id !== targetId
  }

  function handleDragStart(entity, item, parentId) {
    setDraggedItem({ entity, id: item.id, parentId })
  }

  function handleDragEnd() {
    setDraggedItem(null)
    setDropTarget(null)
  }

  function handleDropZoneDragOver(event, targetEntity, targetId) {
    if (!isValidDropZone(draggedItem, targetEntity, targetId)) return
    event.preventDefault()
    setDropTarget({ scope: 'parent', entity: targetEntity, id: targetId })
  }

  function handleDropZoneDrop(event, targetEntity, targetId) {
    if (!isValidDropZone(draggedItem, targetEntity, targetId)) return
    event.preventDefault()

    if (draggedItem.entity === 'tag' && targetEntity === 'category') {
      setDb((prev) => ({
        ...prev,
        tags: moveItemToParentEnd(prev.tags, draggedItem.id, 'category_id', targetId),
      }))
    }

    if (draggedItem.entity === 'question' && targetEntity === 'tag') {
      setDb((prev) => ({
        ...prev,
        questions: moveItemToParentEnd(prev.questions, draggedItem.id, 'tag_id', targetId),
      }))
    }

    if (draggedItem.entity === 'response' && targetEntity === 'question') {
      setDb((prev) => ({
        ...prev,
        responses: moveItemToParentEnd(prev.responses, draggedItem.id, 'question_id', targetId),
      }))
    }

    setDraggedItem(null)
    setDropTarget(null)
  }

  function handleItemDragOver(event, targetEntity, targetId) {
    if (!isValidItemDrop(draggedItem, targetEntity, targetId)) return
    event.preventDefault()
    setDropTarget({ scope: 'item', entity: targetEntity, id: targetId })
  }

  function handleItemDrop(event, targetEntity, targetItem) {
    if (!isValidItemDrop(draggedItem, targetEntity, targetItem.id)) return
    event.preventDefault()

    if (targetEntity === 'category') {
      setDb((prev) => ({
        ...prev,
        categories: moveItemBefore(prev.categories, draggedItem.id, targetItem.id),
      }))
    }

    if (targetEntity === 'tag') {
      setDb((prev) => ({
        ...prev,
        tags: moveItemBefore(prev.tags, draggedItem.id, targetItem.id, (moved, target) => ({
          ...moved,
          category_id: target.category_id,
        })),
      }))
    }

    if (targetEntity === 'question') {
      setDb((prev) => ({
        ...prev,
        questions: moveItemBefore(prev.questions, draggedItem.id, targetItem.id, (moved, target) => ({
          ...moved,
          tag_id: target.tag_id,
        })),
      }))
    }

    if (targetEntity === 'response') {
      setDb((prev) => ({
        ...prev,
        responses: moveItemBefore(prev.responses, draggedItem.id, targetItem.id, (moved, target) => ({
          ...moved,
          question_id: target.question_id,
        })),
      }))
    }

    setDraggedItem(null)
    setDropTarget(null)
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

          <div className="mb-4">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
              <Search size={16} className="text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar categoria, tag, pergunta ou resposta..."
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              {hasSearch && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  Limpar
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Dica: arraste categorias, tags, perguntas e respostas para reorganizar ou mover entre grupos.
            </p>
          </div>

          {categoriesToRender.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
              {hasSearch ? 'Nenhum resultado para a pesquisa atual.' : 'Nenhuma categoria cadastrada.'}
            </div>
          ) : (
            <div className="space-y-3">
              {categoriesToRender.map((category) => {
                const allTags = tagsByCategory.get(category.id) || []
                const tags = hasSearch
                  ? allTags.filter((tag) => visibleBySearch?.tags.has(tag.id))
                  : allTags
                const isCategoryOpen = hasSearch ? true : Boolean(expandedCategories[category.id])

                return (
                  <div
                    key={category.id}
                    onDragOver={(event) => handleDropZoneDragOver(event, 'category', category.id)}
                    onDrop={(event) => handleDropZoneDrop(event, 'category', category.id)}
                    className={`rounded-xl border bg-slate-950/70 p-3 ${
                      dropTarget?.scope === 'parent' &&
                      dropTarget?.entity === 'category' &&
                      dropTarget?.id === category.id
                        ? 'border-emerald-400'
                        : 'border-slate-800'
                    }`}
                  >
                    <RowHeader
                      label={category.name}
                      isOpen={isCategoryOpen}
                      count={tags.length}
                      countLabel="tags"
                      onToggle={() => toggleExpanded('category', category.id)}
                      onEdit={() => openModal('edit', 'category', category)}
                      draggable
                      isDropTarget={
                        dropTarget?.scope === 'item' &&
                        dropTarget?.entity === 'category' &&
                        dropTarget?.id === category.id
                      }
                      onDragStart={() => handleDragStart('category', category, null)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(event) => handleItemDragOver(event, 'category', category.id)}
                      onDrop={(event) => handleItemDrop(event, 'category', category)}
                      onDelete={() => deleteCategory(category.id)}
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

                        {tags.length === 0 ? (
                          <p className="text-sm text-slate-500">Nenhuma tag para esta categoria.</p>
                        ) : (
                          <div className="space-y-2">
                            {tags.map((tag) => {
                              const allQuestions = questionsByTag.get(tag.id) || []
                              const questions = hasSearch
                                ? allQuestions.filter((question) => visibleBySearch?.questions.has(question.id))
                                : allQuestions
                              const isTagOpen = hasSearch ? true : Boolean(expandedTags[tag.id])

                              return (
                                <div
                                  key={tag.id}
                                  onDragOver={(event) => handleDropZoneDragOver(event, 'tag', tag.id)}
                                  onDrop={(event) => handleDropZoneDrop(event, 'tag', tag.id)}
                                  className={`rounded-lg border bg-slate-950/60 p-3 ${
                                    dropTarget?.scope === 'parent' &&
                                    dropTarget?.entity === 'tag' &&
                                    dropTarget?.id === tag.id
                                      ? 'border-emerald-400'
                                      : 'border-slate-800'
                                  }`}
                                >
                                  <RowHeader
                                    label={tag.title}
                                    isOpen={isTagOpen}
                                    count={questions.length}
                                    countLabel="perguntas"
                                    onToggle={() => toggleExpanded('tag', tag.id)}
                                    onEdit={() => openModal('edit', 'tag', tag)}
                                    draggable
                                    isDropTarget={
                                      dropTarget?.scope === 'item' &&
                                      dropTarget?.entity === 'tag' &&
                                      dropTarget?.id === tag.id
                                    }
                                    onDragStart={() => handleDragStart('tag', tag, tag.category_id)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(event) => handleItemDragOver(event, 'tag', tag.id)}
                                    onDrop={(event) => handleItemDrop(event, 'tag', tag)}
                                    onDelete={() => deleteTag(tag.id)}
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

                                      {questions.length === 0 ? (
                                        <p className="text-sm text-slate-500">Nenhuma pergunta para esta tag.</p>
                                      ) : (
                                        <div className="space-y-2">
                                          {questions.map((question) => {
                                            const allResponses = responsesByQuestion.get(question.id) || []
                                            const responses = hasSearch
                                              ? allResponses.filter((response) => visibleBySearch?.responses.has(response.id))
                                              : allResponses
                                            const isQuestionOpen = hasSearch ? true : Boolean(expandedQuestions[question.id])

                                            return (
                                              <div
                                                key={question.id}
                                                onDragOver={(event) => handleDropZoneDragOver(event, 'question', question.id)}
                                                onDrop={(event) => handleDropZoneDrop(event, 'question', question.id)}
                                                className={`rounded-md border bg-slate-950/50 p-3 ${
                                                  dropTarget?.scope === 'parent' &&
                                                  dropTarget?.entity === 'question' &&
                                                  dropTarget?.id === question.id
                                                    ? 'border-emerald-400'
                                                    : 'border-slate-800'
                                                }`}
                                              >
                                                <RowHeader
                                                  label={question.body_questions}
                                                  isOpen={isQuestionOpen}
                                                  count={responses.length}
                                                  countLabel="respostas"
                                                  onToggle={() => toggleExpanded('question', question.id)}
                                                  onEdit={() => openModal('edit', 'question', question)}
                                                  draggable
                                                  isDropTarget={
                                                    dropTarget?.scope === 'item' &&
                                                    dropTarget?.entity === 'question' &&
                                                    dropTarget?.id === question.id
                                                  }
                                                  onDragStart={() => handleDragStart('question', question, question.tag_id)}
                                                  onDragEnd={handleDragEnd}
                                                  onDragOver={(event) => handleItemDragOver(event, 'question', question.id)}
                                                  onDrop={(event) => handleItemDrop(event, 'question', question)}
                                                  onDelete={() => deleteQuestion(question.id)}
                                                />

                                                {isQuestionOpen && (
                                                  <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/40 p-3">
                                                    <ResponseSection
                                                      questionId={question.id}
                                                      responses={responses}
                                                      onSave={upsertResponse}
                                                      onDelete={deleteResponse}
                                                      onDragStartResponse={handleDragStart}
                                                      onDragEndResponse={handleDragEnd}
                                                      onDragOverResponse={handleItemDragOver}
                                                      onDropResponse={handleItemDrop}
                                                      dropTarget={dropTarget}
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
  draggable = false,
  isDropTarget = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-md ${isDropTarget ? 'ring-1 ring-emerald-400' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
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

function ResponseSection({
  questionId,
  responses,
  onSave,
  onDelete,
  onDragStartResponse,
  onDragEndResponse,
  onDragOverResponse,
  onDropResponse,
  dropTarget,
}) {
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

      {responses.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma resposta cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {responses.map((response, index) => (
            <div
              key={response.id}
              draggable
              onDragStart={() => onDragStartResponse('response', response, questionId)}
              onDragEnd={onDragEndResponse}
              onDragOver={(event) => onDragOverResponse(event, 'response', response.id)}
              onDrop={(event) => onDropResponse(event, 'response', response)}
              className={`flex items-center justify-between gap-2 rounded-md border bg-slate-950/70 px-3 py-2 ${
                dropTarget?.scope === 'item' && dropTarget?.entity === 'response' && dropTarget?.id === response.id
                  ? 'border-emerald-400'
                  : 'border-slate-800'
              }`}
            >
              <p className="line-clamp-2 flex-1 text-sm text-slate-300">
                {index + 1}. {response.body_response}
              </p>
              <div className="flex items-center gap-1">
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
          ))}
        </div>
      )}

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
