import { CheckIcon } from '@heroicons/react/24/outline'

export type StepState = 'complete' | 'active' | 'pending'

export type StepItem = {
  label: string
  description?: string
  state: StepState
}

export function Stepper({ steps, label = 'Этапы процесса' }: { steps: StepItem[]; label?: string }) {
  return (
    <ol className="ui-stepper" aria-label={label}>
      {steps.map((step, index) => (
        <li key={`${step.label}-${index}`} className={`ui-stepper__item ui-stepper__item--${step.state}`} aria-current={step.state === 'active' ? 'step' : undefined}>
          <span className="ui-stepper__marker">
            {step.state === 'complete' ? <CheckIcon aria-hidden="true" /> : index + 1}
          </span>
          <span className="ui-stepper__text">
            <strong>{step.label}</strong>
            {step.description ? <small>{step.description}</small> : null}
          </span>
        </li>
      ))}
    </ol>
  )
}
