import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> & { value: string }

/**
 * 내용에 맞춰 높이가 늘어나, 스크롤 없이 전체가 한 번에 보이는 설명칸.
 * rows는 가장 낮을 때의 줄 수다 (SCREEN-SPEC.md "대안과 결정"의 "설명칸 높이").
 */
export function AutoGrowTextarea({ value, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [value])

  return <textarea ref={ref} value={value} {...props} />
}
