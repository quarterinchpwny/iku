import { inject, provide } from 'vue'

const adminAppContextKey = Symbol('admin-app-context')

export function provideAdminAppContext(context) {
  provide(adminAppContextKey, context)
}

export function useAdminAppContext() {
  const context = inject(adminAppContextKey)
  if (!context) {
    throw new Error('Admin app context is not available')
  }
  return context
}
