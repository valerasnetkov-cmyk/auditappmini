import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRightIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  CameraIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
  FolderOpenIcon,
  KeyIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  TruckIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import LoginForm from './login/LoginForm'
import { Accordion } from '@/components/ui'
import { CookieConsentBanner } from './_components/CookieConsentBanner'
import { LandingLightTheme } from './_components/LandingLightTheme'
import { PilotRequestButton, PilotRequestProvider } from './_components/PilotRequestModal'
import styles from './landing.module.css'

export const metadata: Metadata = {
  title: 'Контроль автопарка и фотофиксация осмотров',
  description:
    'Сервис для контроля автопарка: фотоосмотры автомобилей до и после поездки, фиксация дефектов, пробега и ДТП, чек-листы и история техники.',
  keywords: [
    'контроль автопарка',
    'управление автопарком',
    'осмотр автомобиля',
    'фотоосмотр автомобиля',
    'фотофиксация дефектов',
    'учёт дефектов автомобиля',
    'контроль пробега',
    'чек-лист осмотра автомобиля',
    'учёт ДТП',
    'система для автопарка',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    url: '/',
    title: 'Контроль автопарка и фотофиксация осмотров | AuditAvto',
    description:
      'Фиксируйте состояние автомобилей, дефекты, пробег и ДТП в единой доказательной базе.',
  },
}

export const dynamic = 'force-dynamic'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Sakhalin',
})
const numberFormatter = new Intl.NumberFormat('ru-RU')

function getLandingInspectionPreview() {
  const now = new Date()
  const sakhalinDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Sakhalin' }))
  sakhalinDate.setHours(0, 0, 0, 0)

  const nextInspection = new Date(sakhalinDate)
  nextInspection.setDate(nextInspection.getDate() + 7)

  const mileageEpoch = new Date(2026, 0, 1)
  const daysSinceEpoch = Math.max(0, Math.floor((sakhalinDate.getTime() - mileageEpoch.getTime()) / 86_400_000))
  const mileage = 121_500 + daysSinceEpoch * 42

  return {
    inspectionDate: dateFormatter.format(now),
    nextInspectionDate: dateFormatter.format(nextInspection),
    mileage: numberFormatter.format(mileage),
    monthlyMileage: numberFormatter.format(42 * 30),
  }
}

const heroFeatures = [
  ['Осмотр по регламенту', 'Чек-листы и обязательные пункты проверки.', ClipboardDocumentCheckIcon],
  ['Фото как доказательство', 'Фото связаны с машиной, временем и осмотром.', CameraIcon],
  ['История дефектов', 'Замечания и статусы сохраняются в одном месте.', FolderOpenIcon],
  ['Пробег под контролем', 'Фиксация пробега без ручного хаоса.', ChartBarIcon],
]

const problemCards = [
  ['Фото теряются', 'Снимки уходят в чаты, телефоны сотрудников и папки без связи с конкретной техникой.', ChatBubbleLeftRightIcon],
  ['Нет единого стандарта', 'Инспекторы фиксируют состояние по-разному: кто-то забывает ракурсы, одометр или повреждения.', ClipboardDocumentCheckIcon],
  ['Возникают споры', 'Без истории сложно доказать, когда появился дефект и кто отвечал за осмотр.', ExclamationTriangleIcon],
  ['Нет прозрачности', 'Руководитель видит последствия, но не полную картину по парку и осмотрам.', ChartBarIcon],
]

const solutionCards = [
  ['Единый сценарий', 'Техника, фото, чек-лист, дефекты, пробег и отчёт проходят по понятным шагам.', ClipboardDocumentCheckIcon],
  ['Фото привязаны к осмотру', 'Каждое фото связано с машиной, датой, временем и событием.', CameraIcon],
  ['Дефекты не теряются', 'Замечания остаются в истории и помогают видеть повторяющиеся проблемы.', CheckCircleIcon],
  ['Данные у руководителя', 'Владелец и менеджер видят состояние техники без сбора отчётов вручную.', UserGroupIcon],
]

const audienceCards = [
  ['Автопарки', 'Легковой и грузовой парк с регулярными осмотрами до и после смены.', TruckIcon],
  ['Строительная техника', 'Экскаваторы, самосвалы и техника на объектах с высокой ценой простоя.', WrenchScrewdriverIcon],
  ['Коммунальная техника', 'Контроль состояния машин, маршрутов, дефектов и пробега по сменам.', BuildingOffice2Icon],
  ['Логистические компании', 'Единый стандарт фотофиксации для водителей, менеджеров и филиалов.', ChartBarIcon],
  ['Аренда спецтехники', 'Доказательная база при передаче, возврате и спорных повреждениях.', KeyIcon],
]

const inspectionSteps = [
  ['1', 'Выбор техники', 'Инспектор выбирает автомобиль или прицеп из списка.'],
  ['2', 'Фото по зонам', 'Обязательные снимки помогают сохранить единый стандарт.'],
  ['3', 'Чек-лист', 'Пункты осмотра проходят по регламенту компании.'],
  ['4', 'Дефекты и пробег', 'Повреждения и одометр фиксируются с доказательствами.'],
  ['5', 'Готовый отчёт', 'Система собирает данные в историю техники.'],
]

const productSections = [
  {
    title: 'Фотофиксация дефектов',
    text: 'Каждый дефект фиксируется с фото, комментарием и привязкой к осмотру. Это помогает понять, когда появилось повреждение и повторяется ли проблема.',
    image: '/auditavto/002.webp',
    alt: 'Фотофиксация дефектов автомобиля с привязкой к истории осмотра',
    points: ['Фото зоны повреждения', 'Дата и время обнаружения', 'Комментарий инспектора', 'История изменений'],
  },
  {
    title: 'Пробег и ДТП',
    text: 'Пробег подтверждается фото одометра. Для ДТП предусмотрен отдельный сценарий: место, дата, время, общий план и крупные планы повреждений.',
    image: '/auditavto/004.webp',
    alt: 'Фиксация пробега и ДТП в системе контроля автопарка',
    points: ['Фото одометра', 'Динамика пробега', 'Место ДТП', 'Крупные планы повреждений'],
  },
]

const roles = [
  ['Владелец', 'Видит общую картину по компании, технике, осмотрам и проблемным зонам.', UserGroupIcon],
  ['Менеджер', 'Контролирует состояние парка, дефекты, осмотры и сроки.', ChartBarIcon],
  ['Инспектор', 'Проводит осмотры, фиксирует фото, чек-листы, дефекты и пробег.', CameraIcon],
]

const benefits = [
  'Контроль до выхода техники на линию',
  'Доказательная база по повреждениям',
  'Меньше зависимости от человеческого фактора',
  'Прозрачность по технике и сотрудникам',
]

const economicEffects = [
  ['Снижение спорных случаев', 'История осмотров помогает быстрее понять, когда и где появилось повреждение.'],
  ['Сокращение времени проверки', 'Руководитель открывает готовую карточку вместо сбора фото из переписок.'],
  ['Единый стандарт осмотров', 'Обязательные фото и чек-листы снижают риск формальной проверки.'],
  ['Контроль пробега', 'Пробег хранится в истории техники и сопоставляется между осмотрами.'],
  ['История ДТП', 'События, место, фото и комментарии остаются в единой базе.'],
  ['Контроль дефектов', 'Открытые и повторные дефекты видны без ручной сверки таблиц.'],
]

type LandingTariff = {
  code: string
  name: string
  price: string
  period: string
  yearly?: string
  description: string
  features: string[]
  action: string
  pilotSource: string
  planCode: string
  recommended?: boolean
}

type PublicPlan = {
  code: string
  name: string
  description?: string | null
  recommended?: boolean | null
  monthlyPriceRub?: number | null
  yearlyPriceRub?: number | null
  trialMonths?: number | null
  limits?: {
    maxVehicles?: number | null
    maxUsers?: number | null
    maxInspectionsPerMonth?: number | null
    maxStorageMb?: number | null
    storageLimitGb?: number | null
    ocrMonthlyLimit?: number | null
  }
  features?: {
    ocrEnabled?: boolean | null
    accidentModuleEnabled?: boolean | null
    analyticsEnabled?: boolean | null
    pdfReportEnabled?: boolean | null
    exportEnabled?: boolean | null
    apiAccessEnabled?: boolean | null
  }
}

const fallbackTariffs: LandingTariff[] = [
  {
    code: 'pilot',
    name: 'Пилот',
    price: 'По запросу',
    period: 'в месяц',
    description: 'Для тестового внедрения на небольшой группе техники. Новым компаниям доступно 30 дней бесплатно.',
    features: ['30 дней бесплатно для новых компаний', 'Лимит техники из админ-панели', 'Лимит пользователей из админ-панели', 'Лимит осмотров из админ-панели', 'Фото-хранилище по тарифу', 'Доступные модули по тарифу'],
    action: 'Запросить пилот',
    pilotSource: 'tariff-pilot',
    planCode: 'pilot',
  },
  {
    code: 'standard',
    name: 'Стандарт',
    price: 'По запросу',
    period: 'в месяц',
    description: 'Основной тариф для регулярного контроля автопарка.',
    features: ['Лимит техники из админ-панели', 'Лимит пользователей из админ-панели', 'Лимит осмотров из админ-панели', 'Фото-хранилище по тарифу', 'Модули по тарифу', 'Экспорт по тарифу'],
    action: 'Выбрать Стандарт',
    pilotSource: 'tariff-standard',
    planCode: 'standard',
    recommended: true,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: 'По запросу',
    period: 'в месяц',
    description: 'Для крупных парков, филиалов и индивидуальных требований.',
    features: ['Лимиты из админ-панели', 'Индивидуальные условия', 'Фото-хранилище по тарифу', 'API и SLA по тарифу', 'Экспорт по тарифу'],
    action: 'Обсудить условия',
    pilotSource: 'tariff-enterprise',
    planCode: 'enterprise',
  },
]

function apiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '')
}

function money(value?: number | null) {
  return value ? `${value.toLocaleString('ru-RU')} ₽` : 'По запросу'
}

function storageGb(plan: PublicPlan) {
  const direct = plan.limits?.storageLimitGb
  if (direct !== null && direct !== undefined) return direct
  const mb = plan.limits?.maxStorageMb
  if (mb === null || mb === undefined) return null
  return Math.round((mb / 1024) * 10) / 10
}

function limitFeature(label: string, value?: number | null, mode: 'upTo' | 'from' = 'upTo') {
  if (value === null || value === undefined) return 'Индивидуальные лимиты'
  const prefix = mode === 'from' ? 'От' : 'До'
  return `${prefix} ${value.toLocaleString('ru-RU')} ${label}`
}

function actionForPlan(code: string) {
  if (code === 'standard') return 'Выбрать Стандарт'
  if (code === 'enterprise') return 'Обсудить условия'
  return 'Запросить пилот'
}

function descriptionForPlan(plan: PublicPlan) {
  if (plan.description) return plan.description
  return fallbackTariffs.find((item) => item.code === plan.code)?.description || 'Тариф для работы с автопарком.'
}

function featuresForPlan(plan: PublicPlan) {
  const enterprise = plan.code === 'enterprise'
  const features: string[] = []
  if ((plan.trialMonths || 0) > 0) features.push('30 дней бесплатно для новых компаний')
  features.push(limitFeature('единиц техники', plan.limits?.maxVehicles, enterprise ? 'from' : 'upTo'))
  features.push(limitFeature('пользователей', plan.limits?.maxUsers, enterprise ? 'from' : 'upTo'))
  features.push(
    plan.limits?.maxInspectionsPerMonth === null || plan.limits?.maxInspectionsPerMonth === undefined
      ? 'Индивидуальные лимиты осмотров'
      : `До ${plan.limits.maxInspectionsPerMonth.toLocaleString('ru-RU')} осмотров в месяц`,
  )
  const storage = storageGb(plan)
  features.push(storage === null ? 'Индивидуальное фото-хранилище' : `${enterprise ? 'От ' : ''}${storage.toLocaleString('ru-RU')} ГБ фото-хранилища`)
  if (plan.features?.apiAccessEnabled) {
    features.push('API, отдельный контур и SLA')
  } else if (plan.features?.ocrEnabled && plan.features?.analyticsEnabled) {
    features.push('OCR, аналитика и экспорт')
  } else if (plan.features?.ocrEnabled || plan.features?.accidentModuleEnabled) {
    features.push('OCR и ДТП-осмотры')
  }
  if (plan.features?.pdfReportEnabled || plan.features?.exportEnabled) features.push('Выгрузка PDF-отчётов')
  return features
}

function mapPlanToTariff(plan: PublicPlan): LandingTariff {
  const fallback = fallbackTariffs.find((item) => item.code === plan.code)
  return {
    code: plan.code,
    name: plan.name || fallback?.name || plan.code,
    price: money(plan.monthlyPriceRub),
    period: 'в месяц',
    yearly: plan.yearlyPriceRub ? `${plan.yearlyPriceRub.toLocaleString('ru-RU')} ₽ в год` : undefined,
    description: descriptionForPlan(plan),
    features: featuresForPlan(plan),
    action: fallback?.action || actionForPlan(plan.code),
    pilotSource: fallback?.pilotSource || `tariff-${plan.code}`,
    planCode: plan.code,
    recommended: Boolean(plan.recommended),
  }
}

async function getLandingTariffs(): Promise<LandingTariff[]> {
  try {
    const response = await fetch(`${apiBaseUrl()}/public/plans`, { cache: 'no-store' })
    if (!response.ok) return fallbackTariffs
    const data = await response.json() as { plans?: PublicPlan[] }
    const plans = Array.isArray(data.plans) ? data.plans : []
    const tariffs = plans.filter((plan) => plan.code).map(mapPlanToTariff)
    return tariffs.length ? tariffs : fallbackTariffs
  } catch {
    return fallbackTariffs
  }
}

const faqs = [
  ['Что такое «Аудит авто»?', '«Аудит авто» — сервис фотофиксации состояния автотехники: осмотры, дефекты, пробег, ДТП и история по каждому автомобилю в одной системе.'],
  ['Какую проблему решает сервис?', 'Он убирает хаос из фото в мессенджерах и устных договорённостей. Компания видит, кто, когда и в каком состоянии зафиксировал автомобиль.'],
  ['Чем сервис лучше обычных фото в мессенджерах?', 'Каждое фото привязано к автомобилю, осмотру, дате, времени, инспектору, дефекту и истории техники. Это уже не просто фото, а доказательная база.'],
  ['Можно ли завершить осмотр без обязательных фото?', 'Нет. Система не даст закрыть осмотр без нужных снимков по выбранному типу проверки. Это защищает бизнес от формальных и неполных осмотров.'],
  ['Какую выгоду получает владелец бизнеса?', 'Владелец получает прозрачный контроль автопарка: меньше спорных ситуаций, проще разбирать повреждения и ДТП, быстрее находить проблемную технику и подтверждать факты документально.'],
]

type IconType = typeof CameraIcon

function SmallCard({ title, text, icon: Icon }: { title: string; text: string; icon: IconType }) {
  return (
    <article className={styles.smallCard}>
      <Icon aria-hidden="true" className={styles.cardIcon} />
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  )
}

function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.sectionTitle}>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  )
}

export default async function LandingPage() {
  const inspectionPreview = getLandingInspectionPreview()
  const tariffs = await getLandingTariffs()

  return (
    <PilotRequestProvider>
      <LandingLightTheme />
      <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.panel}>
          <header className={styles.topbar}>
            <Link href="/" aria-label="AuditAvto" className={styles.brand}>
              <Image src="/brand/auditavto-logo-horizontal.svg" alt="AuditAvto" width={244} height={48} priority />
            </Link>
            <div className={styles.topMeta}>
              <span><ShieldCheckIcon aria-hidden="true" /> Безопасно и надёжно</span>
              <span><CloudArrowUpIcon aria-hidden="true" /> SaaS-платформа</span>
            </div>
          </header>

          <div className={styles.hero}>
            <div className={styles.heroCopy}>
              <h1>Контроль автопарка без спорных фото и ручного хаоса</h1>
              <p>
                Фотоосмотр автомобиля до и после поездки. Фиксируйте дефекты, пробег, ДТП и историю состояния в одном отчёте.
              </p>
              <div className={styles.heroActions}>
                <PilotRequestButton source="hero" className={styles.primaryButton}>
                  Запустить пилот
                  <ArrowRightIcon aria-hidden="true" />
                </PilotRequestButton>
                <Link href="/demo" className={styles.secondaryButton}>Посмотреть демо</Link>
              </div>
              <p className={styles.audience}>
                Для новых компаний — 30 дней бесплатно. Подходит автопаркам, доставке, аренде, строительной технике, сервисным и транспортным компаниям.
              </p>

              <div className={`${styles.heroFeatureGrid} ${styles.desktopHeroFeatures}`}>
                {heroFeatures.map(([title, text, Icon]) => (
                  <SmallCard key={title as string} title={title as string} text={text as string} icon={Icon as IconType} />
                ))}
              </div>

            </div>

            <aside className={styles.loginPanel}>
              <h2>Вход в систему</h2>
              <p>Войдите в аккаунт вашей компании</p>
              <LoginForm defaultNextPath="/dashboard" showAccessAction variant="landing" />
              <div className={styles.loginNote}>
                <UserGroupIcon aria-hidden="true" />
                Для владельцев и менеджеров
              </div>
            </aside>

            <div className={`${styles.heroFeatureGrid} ${styles.mobileHeroFeatures}`}>
              {heroFeatures.map(([title, text, Icon]) => (
                <SmallCard key={title as string} title={title as string} text={text as string} icon={Icon as IconType} />
              ))}
            </div>

            <div className={styles.productPreview}>
              <article className={styles.vehicleCard}>
                <div className={styles.vehicleHeader}>
                  <div>
                    <h3>КАМАЗ 5490</h3>
                    <span>A·123BC 797</span>
                  </div>
                  <strong>В работе</strong>
                </div>
                <div className={styles.vehiclePhoto}>
                  <Image src="/auditavto/009.png" alt="Мобильный осмотр техники с фото, чек-листом, дефектами и пробегом" width={229} height={185}/>
                </div>
                <dl>
                  <dt>Тип ТС</dt><dd>Грузовой тягач</dd>
                  <dt>Год выпуска</dt><dd>2021</dd>
                  <dt>Водитель</dt><dd>Иванов А. С.</dd>
                </dl>
              </article>

              <article className={styles.checkCard}>
                <div className={styles.checkHeader}>
                  <h3>Осмотр от {inspectionPreview.inspectionDate}</h3>
                  <span>72%</span>
                </div>
                <div className={styles.progress}><span /></div>
                <ul>
                  <li><CheckCircleIcon aria-hidden="true" /> Кузов</li>
                  <li><CheckCircleIcon aria-hidden="true" /> Фото по зонам</li>
                  <li><ExclamationTriangleIcon aria-hidden="true" /> Шины и диски</li>
                  <li><CheckCircleIcon aria-hidden="true" /> Документы</li>
                </ul>
                <div className={styles.vehicleFacts}>
                  <div><span>Пробег</span><strong>{inspectionPreview.mileage} км</strong><small>+{inspectionPreview.monthlyMileage} км за месяц</small></div>
                  <div><span>Дефекты</span><strong>3 замечания</strong><small>1 требует внимания</small></div>
                  <div><span>Тех. состояние</span><strong>Хорошее</strong><small>Готов к эксплуатации</small></div>
                  <div><span>Следующий осмотр</span><strong>{inspectionPreview.nextInspectionDate}</strong><small>Через 7 дней</small></div>
                </div>
              </article>

              <article className={styles.defectStrip}>
                <div>
                  <h3>Обнаруженные дефекты</h3>
                  <span>3</span>
                </div>
                <div className={styles.defectPhotos}>
                  {['004.webp', '005.webp', '001.webp'].map((image) => (
                    <Image key={image} src={`/auditavto/${image}`} alt="Фото дефекта автомобиля" width={130} height={88} />
                  ))}
                </div>
              </article>
            </div>
          </div>

          <div className={styles.securityStrip}>
            <div><LockClosedIcon aria-hidden="true" /><strong>Защищённая передача</strong><span>Публичный сайт и API работают по HTTPS</span></div>
            <div><CloudArrowUpIcon aria-hidden="true" /><strong>Резервные копии</strong><span>Предусмотрены процедуры создания и проверки копий</span></div>
            <div><KeyIcon aria-hidden="true" /><strong>Контроль доступа</strong><span>Роли и права для вашей команды</span></div>
          </div>
        </div>
      </section>

      <section id="problem" className={styles.section}>
        <SectionTitle
          title="Когда осмотры ведутся в чатах — бизнес теряет контроль"
          text="Фото теряются, дефекты фиксируются по-разному, пробег записывается вручную, а при споре сложно доказать, когда появилось повреждение."
        />
        <div className={styles.twoColumn}>
          <div className={styles.imageFrame}>
            <Image src="/auditavto/008.webp" alt="Проблемы владельца автопарка при ведении осмотров в чатах и таблицах" fill sizes="(min-width: 960px) 45vw, 100vw" />
          </div>
          <div className={styles.cardGrid}>
            {problemCards.map(([title, text, Icon]) => (
              <SmallCard key={title as string} title={title as string} text={text as string} icon={Icon as IconType} />
            ))}
          </div>
        </div>
      </section>

      <section id="solution" className={styles.section}>
        <SectionTitle
          title="AuditAvto превращает каждый осмотр в понятный цифровой отчёт"
          text="Инспектор проходит сценарий проверки, делает обязательные фото, фиксирует дефекты и пробег. Руководитель получает структурированную историю по каждой машине."
        />
        <div className={styles.fourGrid}>
          {solutionCards.map(([title, text, Icon]) => (
            <SmallCard key={title as string} title={title as string} text={text as string} icon={Icon as IconType} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.lossPanel}>
          <div className={styles.lossScenario}>
            <span className={styles.eyebrow}>Стоимость одной спорной ситуации</span>
            <h2>Одно повреждение может стоить дороже месяца цифрового контроля</h2>
            <div className={styles.lossAmount}>
              <span>Повреждение автомобиля</span>
              <strong>120 000 ₽</strong>
            </div>
            <p>
              Если фотографий нет, невозможно быстро определить виновного, момент появления дефекта и состояние техники до передачи.
            </p>
          </div>
          <div className={styles.lossResult}>
            <h3>Без AuditAvto</h3>
            <p>Затраты компании, конфликт между сотрудниками и разбор по памяти вместо фактов.</p>
            <h3>AuditAvto хранит</h3>
            <ul>
              {['историю осмотров', 'фотофиксацию', 'пробег', 'дефекты', 'отчёты', 'выгрузку PDF-отчётов'].map((item) => (
                <li key={item}><CheckCircleIcon aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <SectionTitle
          title="Для кого"
          text="AuditAvto полезен там, где техника передаётся между людьми, работает в сменах и любая спорная ситуация превращается в прямые расходы."
        />
        <div className={styles.audienceGrid}>
          {audienceCards.map(([title, text, Icon]) => (
            <SmallCard key={title as string} title={title as string} text={text as string} icon={Icon as IconType} />
          ))}
        </div>
      </section>

      <section id="how" className={styles.section}>
        <SectionTitle
          title="Как работает осмотр"
          text="Инспектор проводит осмотр, загружает фотографии, система фиксирует данные, формирует отчёт, а руководитель получает результат."
        />
        <div className={styles.steps}>
          {inspectionSteps.map(([number, title, text]) => (
            <article key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.productSections}>
          {productSections.map((section, index) => (
            <article key={section.title} className={styles.productSection}>
              <div className={styles.imageFrame}>
                <Image src={section.image} alt={section.alt} fill sizes="(min-width: 960px) 42vw, 100vw" loading="eager" />
              </div>
              <div>
                <h2>{section.title}</h2>
                <p>{section.text}</p>
                <ul>
                  {section.points.map((point) => <li key={point}><CheckCircleIcon aria-hidden="true" />{point}</li>)}
                </ul>
                {index === 0 ? (
                  <div className={styles.accentNote}>
                    <CameraIcon aria-hidden="true" />
                    <strong>Фото = доказательство</strong>
                    <span>Привязка к осмотру обеспечивает прозрачность и защищает от споров.</span>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <SectionTitle
          title="Безопасность и роли"
          text="Владелец видит общую картину, менеджер контролирует парк, инспектор проводит осмотры. Доступ разделён по ролям."
        />
        <div className={styles.threeGrid}>
          {roles.map(([title, text, Icon]) => (
            <SmallCard key={title as string} title={title as string} text={text as string} icon={Icon as IconType} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.benefitPanel}>
          <div>
            <h2>Что получает владелец автопарка</h2>
            <p>Понятную историю по технике, доказательную базу по повреждениям и меньше зависимости от человеческого фактора.</p>
          </div>
          <ul>
            {benefits.map((benefit) => <li key={benefit}><CheckCircleIcon aria-hidden="true" />{benefit}</li>)}
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <SectionTitle
          title="Экономический эффект"
          text="Система не просто хранит фото: она снижает стоимость хаоса вокруг осмотров, дефектов, пробега и ДТП."
        />
        <div className={styles.effectGrid}>
          {economicEffects.map(([title, text]) => (
            <article key={title}>
              <BanknotesIcon aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.demoSection}`}>
        <div>
          <h2>Посмотрите демо с тестовым автопарком</h2>
          <p>
            Откройте демо-кабинет и посмотрите, как руководитель видит технику, осмотры, дефекты, фотофиксацию, пробег и отчёты.
          </p>
          <div className={styles.heroActions}>
            <Link href="/demo" className={styles.primaryButton}>
              Открыть демо
              <ArrowRightIcon aria-hidden="true" />
            </Link>
            <PilotRequestButton source="demo-section" className={styles.secondaryButton}>Запросить пилот</PilotRequestButton>
          </div>
          <small>Демо содержит только тестовые данные. Реальные компании и фото недоступны.</small>
        </div>
        <div className={styles.demoChecklist}>
          <span><CheckCircleIcon aria-hidden="true" /> 12 единиц техники</span>
          <span><CheckCircleIcon aria-hidden="true" /> 36 осмотров</span>
          <span><CheckCircleIcon aria-hidden="true" /> Активные и закрытые дефекты</span>
          <span><CheckCircleIcon aria-hidden="true" /> Пробег, фото и ДТП-сценарии</span>
        </div>
      </section>

      <section id="tariffs" className={styles.section}>
        <SectionTitle
          title="Тарифы для автопарков разного масштаба"
          text="Начните с пилотной группы техники или выберите тариф для регулярной работы. Индивидуальные лимиты можно увеличить без смены системы."
        />
        <div className={styles.tariffGrid}>
          {tariffs.map((tariff) => (
            <article
              key={tariff.code}
              className={`${styles.tariffCard} ${tariff.recommended ? styles.tariffRecommended : ''}`}
            >
              <div className={styles.tariffHeader}>
                <div>
                  <h3>{tariff.name}</h3>
                  <p>{tariff.description}</p>
                </div>
                {tariff.recommended ? <span>Рекомендуем</span> : null}
              </div>
              <div className={styles.tariffPrice}>
                <strong>{tariff.price}</strong>
                <span>{tariff.period}</span>
              </div>
              {tariff.yearly ? <p className={styles.tariffYearly}>{tariff.yearly}</p> : null}
              <ul>
                {tariff.features.map((feature) => (
                  <li key={feature}><CheckCircleIcon aria-hidden="true" />{feature}</li>
                ))}
              </ul>
              {tariff.pilotSource ? (
                <PilotRequestButton
                  source={tariff.pilotSource}
                  planCode={tariff.planCode}
                  className={tariff.recommended ? styles.primaryButton : styles.secondaryButton}
                >
                  {tariff.action}
                  {tariff.recommended ? <ArrowRightIcon aria-hidden="true" /> : null}
                </PilotRequestButton>
              ) : null}
            </article>
          ))}
        </div>
        <p className={styles.tariffFootnote}>
          Дополнительная техника, хранилище, OCR-запросы и внедрение рассчитываются отдельно.
        </p>
      </section>

      <section className={styles.offer}>
        <div>
          <h2>Запустите цифровой контроль на пилотной группе техники</h2>
          <p>Подключим компанию, добавим технику, настроим роли и базовые сценарии осмотров. После пилота вы увидите, где теряются данные и какие дефекты повторяются.</p>
        </div>
        <div className={styles.offerActions}>
          <PilotRequestButton source="pilot-offer" className={styles.primaryButton}>Запросить пилот <ArrowRightIcon aria-hidden="true" /></PilotRequestButton>
          <PilotRequestButton source="demo-request" className={styles.secondaryButton}>Получить демонстрацию</PilotRequestButton>
        </div>
      </section>

      <section className={styles.section}>
        <SectionTitle title="FAQ" text="Короткие ответы на вопросы перед пилотным запуском." />
        <div className={styles.faq}>
          {faqs.map(([question, answer]) => (
            <Accordion key={question} title={question}>
              <p>{answer}</p>
            </Accordion>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <h2>Хватит собирать осмотры из чатов и таблиц</h2>
        <p>Запустите AuditAvto на части автопарка и проверьте, насколько проще становится контроль техники, дефектов, пробега и ДТП.</p>
        <PilotRequestButton source="final-cta" className={styles.primaryButton}>Проверить систему на своём автопарке <ArrowRightIcon aria-hidden="true" /></PilotRequestButton>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerBrand} aria-label="AuditAvto">
          <Image src="/brand/auditavto-logo-horizontal.svg" alt="AuditAvto" width={244} height={48} />
        </Link>
        <nav aria-label="Правовая информация">
          <Link href="/privacy">Политика ПДн</Link>
          <Link href="/personal-data-consent">Согласие ПДн</Link>
          <Link href="/terms">Пользовательское соглашение</Link>
          <Link href="/offer">Оферта</Link>
          <Link href="/marketing-consent">Согласие на рассылку</Link>
          <Link href="/security">Безопасность</Link>
          <Link href="/cookie-policy">Cookies</Link>
        </nav>
        <a href="mailto:info@auditavto.ru">info@auditavto.ru</a>
      </footer>
      <CookieConsentBanner />
    </main>
    </PilotRequestProvider>
  )
}
