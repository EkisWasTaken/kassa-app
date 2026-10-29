<script setup>
import * as echarts from 'echarts'
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { theme, resolveDeep } from './theme.js'

const props = defineProps({ option: Object, label: String, height: { type: Number, default: 240 } })
const el = ref()
let chart, ro

const base = {
  textStyle: { fontFamily: "'Manrope Variable', Manrope, sans-serif", color: 'var(--muted)' },
  tooltip: { backgroundColor: '#16161A', borderColor: '#3A3B44', textStyle: { color: '#fff', fontSize: 12 } },
}
const render = () => chart?.setOption(resolveDeep({ ...base, ...props.option }), true)

onMounted(() => {
  chart = echarts.init(el.value, null, { renderer: 'svg' })
  render()
  ro = new ResizeObserver(() => chart.resize())
  ro.observe(el.value)
})
watch(() => props.option, render)
watch(theme, render) // colours given as var(--x) are re-read for the new theme
onBeforeUnmount(() => { ro?.disconnect(); chart?.dispose() })
</script>

<template>
  <div ref="el" class="chart" role="img" :aria-label="label" :style="{ height: height + 'px' }"></div>
</template>
