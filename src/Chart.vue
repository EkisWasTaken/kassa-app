<script setup>
import * as echarts from 'echarts'
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { theme, resolveDeep } from './theme.js'

const props = defineProps({ option: Object, label: String, height: { type: Number, default: 240 } })
const el = ref()
let chart, ro

const base = {
  textStyle: { fontFamily: "'Hanken Grotesk Variable', sans-serif", color: 'var(--muted)' },
  tooltip: { backgroundColor: 'var(--hero)', borderWidth: 0, padding: [8, 12], textStyle: { color: 'var(--hero-ink)', fontSize: 13 } },
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
