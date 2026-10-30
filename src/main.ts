import './assets/main.css'
import 'vue-sonner/style.css'

import { registerSW } from 'virtual:pwa-register'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}

createApp(App).use(router).mount('#app')
