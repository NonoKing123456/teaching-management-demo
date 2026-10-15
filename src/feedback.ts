import { onScopeDispose, ref, shallowReactive, watch, type Ref } from 'vue'

type Feedback = {
  id: string
  kind: 'error' | 'success'
  message: string
  dismiss: () => void
}

export const feedbackMessages = shallowReactive<Feedback[]>([])
let nextOwner = 0

export function useFeedback(enabled?: Readonly<Ref<boolean>>) {
  const owner = ++nextOwner
  const error = ref('')
  const notice = ref('')

  function sync(kind: Feedback['kind'], message: string, source: Ref<string>) {
    const id = `${owner}-${kind}`
    const index = feedbackMessages.findIndex(item => item.id === id)
    if (!message) {
      if (index >= 0) feedbackMessages.splice(index, 1)
      return
    }
    const item = { id, kind, message, dismiss: () => { source.value = '' } }
    if (index >= 0) feedbackMessages.splice(index, 1, item)
    else feedbackMessages.push(item)
  }

  watch([error, notice, () => enabled?.value ?? true], ([errorText, noticeText, visible]) => {
    sync('error', visible ? errorText : '', error)
    sync('success', visible ? noticeText : '', notice)
  }, { flush: 'sync' })

  onScopeDispose(() => {
    for (let index = feedbackMessages.length - 1; index >= 0; index--) {
      if (feedbackMessages[index]!.id.startsWith(`${owner}-`)) feedbackMessages.splice(index, 1)
    }
  })

  return { error, notice }
}
