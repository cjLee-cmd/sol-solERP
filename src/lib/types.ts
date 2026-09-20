export type Role = 'master' | 'sub'

export type Profile = {
  display_name: string
  role: Role
}

export type Program = {
  id: string
  name_en: string
  name_ko: string
  url: string
  embed_mode: 'iframe' | 'window'
  accent_token: string
  enabled: boolean
}

export type ActivityEntry = {
  id: number
  message: string
  created_at: string
  program_id: string | null
}
