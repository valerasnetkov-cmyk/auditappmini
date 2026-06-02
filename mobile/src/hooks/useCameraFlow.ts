import { useState } from 'react'

export type CameraTarget =
  | 'plate_ocr'
  | { kind: 'inspection'; photoType: string }
  | { kind: 'defect'; title: string }

export function cameraTargetEquals(a: CameraTarget | null, b: CameraTarget | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a === 'plate_ocr' || b === 'plate_ocr') return false
  if (a.kind === 'inspection' && b.kind === 'inspection') return a.photoType === b.photoType
  if (a.kind === 'defect' && b.kind === 'defect') return a.title === b.title
  return false
}

export function useCameraFlow() {
  const [showCamera, setShowCamera] = useState(false)
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null)

  const openCamera = (target: CameraTarget) => {
    setCameraTarget(target)
    setShowCamera(true)
  }

  const closeCamera = () => {
    setShowCamera(false)
    setCameraTarget(null)
  }

  return { showCamera, cameraTarget, openCamera, closeCamera }
}
