import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRightIcon,
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
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import LoginForm from './login/LoginForm'
import styles from './landing.module.css'

export const metadata: Metadata = {
  title: 'AuditAvto — цифровой контроль автопарка и фотофиксация осмотров',
  description:
    'Сервис для владельцев автопарков: осмотры техники, фотофиксация дефектов, пробег, ДТП и история состояния автомобилей в одной системе.',
}

const contactHref = 'mailto:info@auditavto.ru?subject=Запросить пилот AuditAvto'

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

const tariffs = [
  {
    code: 'pilot',
    name: 'Пилот',
    price: '9 900 ₽',
    period: 'в месяц',
    description: 'Для тестового внедрения на небольшой группе техники.',
    features: ['До 10 единиц техники', 'До 3 пользователей', 'До 300 осмотров в месяц', '10 ГБ фото-хранилища', 'OCR и ДТП-осмотры'],
    action: 'Запросить пилот',
    href: contactHref,
  },
  {
    code: 'standard',
    name: 'Стандарт',
    price: '24 900 ₽',
    period: 'в месяц',
    yearly: '249 000 ₽ в год',
    description: 'Основной тариф для регулярного контроля автопарка.',
    features: ['До 50 единиц техники', 'До 10 пользователей', 'До 2 000 осмотров в месяц', '50 ГБ фото-хранилища', 'OCR, аналитика и экспорт'],
    action: 'Выбрать Стандарт',
    href: 'mailto:info@auditavto.ru?subject=Подключить тариф Стандарт AuditAvto',
    recommended: true,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: 'от 79 000 ₽',
    period: 'в месяц',
    description: 'Для крупных парков, филиалов и индивидуальных требований.',
    features: ['От 150 единиц техники', 'От 30 пользователей', 'Индивидуальные лимиты', 'От 200 ГБ хранилища', 'API, отдельный контур и SLA'],
    action: 'Обсудить условия',
    href: 'mailto:info@auditavto.ru?subject=Обсудить тариф Enterprise AuditAvto',
  },
]

const faqs = [
  ['Что такое «Аудит авто»?', '«Аудит авто» — сервис фотофиксации состояния автотехники: осмотры, дефекты, пробег, ДТП и история по каждому автомобилю в одной системе.'],
  ['Какую проблему решает сервис?', 'Он убирает хаос из фото в мессенджерах и устных договорённостей. Компания видит, кто, когда и в каком состоянии зафиксировал автомобиль.'],
  ['Чем сервис лучше обычных фото в Maxx или Telegram?', 'Каждое фото привязано к автомобилю, осмотру, дате, времени, инспектору, дефекту и истории техники. Это уже не просто фото, а доказательная база.'],
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

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.panel}>
          <header className={styles.topbar}>
            <Link href="/" aria-label="AuditAvto" className={styles.brand}>
              <Image src="/auditavto/logo3.png" alt="AuditAvto" width={300} height={60} priority />
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
                AuditAvto помогает фиксировать состояние техники: фото, дефекты, пробег, ДТП, время и историю осмотров — в одной системе.
              </p>
              <div className={styles.heroActions}>
                <a href={contactHref} className={styles.primaryButton}>
                  Запросить пилот
                  <ArrowRightIcon aria-hidden="true" />
                </a>
                <a href="#how" className={styles.secondaryButton}>Посмотреть демо</a>
              </div>
              <p className={styles.audience}>
                Для автопарков, доставки, аренды, строительной техники, сервисных и транспортных компаний.
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
                Для владельцев, менеджеров и инспекторов
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
                  <h3>Осмотр от 24.05.2026</h3>
                  <span>72%</span>
                </div>
                <div className={styles.progress}><span /></div>
                <ul>
                  <li><CheckCircleIcon aria-hidden="true" /> Кузов</li>
                  <li><CheckCircleIcon aria-hidden="true" /> Фото по зонам</li>
                  <li><ExclamationTriangleIcon aria-hidden="true" /> Шины и диски</li>
                  <li><CheckCircleIcon aria-hidden="true" /> Документы</li>
                </ul>
              </article>

              <article className={styles.metricCard}>
                <span>Пробег, км</span>
                <strong>128 450</strong>
                <small>+1 250 относительно 23.05.2026</small>
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
            <div><LockClosedIcon aria-hidden="true" /><strong>Шифрование данных</strong><span>Защита информации на всех уровнях</span></div>
            <div><CloudArrowUpIcon aria-hidden="true" /><strong>Резервное копирование</strong><span>Ежедневное хранение и восстановление</span></div>
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

      <section id="how" className={styles.section}>
        <SectionTitle
          title="Как работает осмотр"
          text="Пять шагов вместо разрозненных сообщений, таблиц и ручных отчётов."
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
              <a
                href={tariff.href}
                className={tariff.recommended ? styles.primaryButton : styles.secondaryButton}
              >
                {tariff.action}
                {tariff.recommended ? <ArrowRightIcon aria-hidden="true" /> : null}
              </a>
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
          <a href={contactHref} className={styles.primaryButton}>Запросить пилот <ArrowRightIcon aria-hidden="true" /></a>
          <a href="mailto:info@auditavto.ru?subject=Получить консультацию AuditAvto" className={styles.secondaryButton}>Получить консультацию</a>
        </div>
      </section>

      <section className={styles.section}>
        <SectionTitle title="FAQ" text="Короткие ответы на вопросы перед пилотным запуском." />
        <div className={styles.faq}>
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <h2>Хватит собирать осмотры из чатов и таблиц</h2>
        <p>Запустите AuditAvto на части автопарка и проверьте, насколько проще становится контроль техники, дефектов, пробега и ДТП.</p>
        <a href={contactHref} className={styles.primaryButton}>Запросить пилот <ArrowRightIcon aria-hidden="true" /></a>
      </section>
    </main>
  )
}
