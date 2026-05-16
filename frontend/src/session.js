const KEY = 'sa_session_id'
let id = localStorage.getItem(KEY)
if (!id) {
  id = `demo_${Date.now()}`
  localStorage.setItem(KEY, id)
}
export const SESSION_ID = id
