// Bilingual overrides from wall.js
const i18n = {
  "Hello I\u2019m Jesse Lai": {
    zh: { title: '你好，我是Jesse Lai', body: '微软AI产品设计师，探索人与AI自然交互的未来。' },
    en: { title: "Hello I'm Jesse Lai", body: 'AI Product Designer at Microsoft, exploring the future of natural human-AI interaction.' },
  },
  'Microsoft': {
    zh: { title: 'Microsoft', body: '在微软构建AI产品，设计下一代人机交互体验。' },
    en: { title: 'Microsoft', body: 'Building AI products at Microsoft, designing next-gen human-AI interaction experiences.' },
  },
  'Alibaba': {
    zh: { title: 'Alibaba', body: '构建AI产品，帮助本地生活服务用户获得更好的体验。' },
    en: { title: 'Alibaba', body: 'Building AI products to help local service users get better experiences.' },
  },
  'Stand-up Comedian': {
    zh: { title: '脱口秀演员', body: '脱口秀是我一生的热爱。把生活的酸甜苦辣变成段子搬上舞台，已经成为我生活不可分割的一部分。' },
    en: { title: 'Stand-up Comedian', body: "Stand-up comedy is a lifelong passion. Turning life's highs and lows into jokes on stage has become an inseparable part of my life." },
  },
  'Drawing': {
    zh: { title: '画画', body: '用画笔记录生活中的美好瞬间。' },
    en: { title: 'Drawing', body: 'Capturing beautiful moments in life with a brush.' },
  },
  'Vibe Coding': {
    zh: { title: 'Vibe Coding', body: 'Vibe Coding项目合集——用代码构建创意工具和交互体验。' },
    en: { title: 'Vibe Coding', body: 'A collection of vibe coding projects — building creative tools and interactive experiences with code.' },
  },
  'Arduino Light': {
    zh: { title: 'Arduino交互灯', body: '用Arduino打造的交互灯——硬件与创意的融合。' },
    en: { title: 'Arduino Light', body: 'An interactive light built with Arduino — merging hardware and creativity.' },
  },
  'GenUI 设计指南': {
    zh: { title: 'GenUI 设计指南', body: '在AI时代，我们的交互体验反而倒退了——从丰富的GUI退回到纯文字聊天。GenUI探索AI生成的界面，让信息回归应有的形态。' },
    en: { title: 'GenUI', body: 'In the AI era, our interaction experiences have regressed — from rich GUIs back to text-based chat. GenUI explores AI-generated interfaces that match the shape of information.' },
  },
  'AI产品设计原则': {
    zh: { title: 'AI产品设计原则', body: '我对AI产品设计原则的思考与实践总结。' },
    en: { title: 'AI Design Principles', body: 'A growing collection of AI product design principles, drawing from industry leaders and my own practice.' },
  },
  'Born Builder': {
    zh: { title: '天生创造者', body: '这个项目提醒我——我是一个创造者。无论是否在AI时代，让东西活起来都让我兴奋！' },
    en: { title: 'Born Builder', body: "This project reminds me — I'm a builder. Whether or not we're in the AI era, making things come to life excites me!" },
  },
}

export function getI18nText(originalTitle, field, lang, entry) {
  const override = i18n[originalTitle]
  if (override && override[lang] && override[lang][field]) {
    return override[lang][field]
  }
  // Fallback
  if (field === 'title') return entry?.title_en && lang === 'en' ? entry.title_en : originalTitle
  if (field === 'body') return entry?.body_en && lang === 'en' ? entry.body_en : entry?.body || ''
  if (field === 'caption') return originalTitle
  return ''
}
