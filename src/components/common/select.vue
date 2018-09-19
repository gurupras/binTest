<template>
  <div>
    <select @change="onChange">
      <option v-if="message" value="" disabled selected>{{message}}</option>
      <option v-for="option in options" :value="option.value || option" :key="option.key || option.value || option">
        {{ option.text || option }}
      </option>
    </select>
    <label>{{label}}</label>
  </div>
</template>

<script>
export default {
  name: 'vue-select',
  model: {
    prop: 'value',
    event: 'change'
  },
  props: {
    options: {
      type: Array,
      default () {
        return []
      }
    },
    message: {
      type: String,
      default: 'Select an option'
    },
    label: {
      type: String,
      default: 'Select'
    },
    value: {
      type: String,
      default: ''
    }
  },
  methods: {
    onChange (e) {
      this.$emit('change', e.target.value)
    },
    update (val) {
      const selectEl = this.$el.querySelector('select')
      selectEl.querySelector(`option[value="${val}"]`).selected = true
      window.M.FormSelect.init(selectEl)
    }
  },
  mounted () {
    const self = this
    const selectEl = this.$el.querySelector('select')
    window.M.FormSelect.init(selectEl)
    this.$nextTick(() => {
      self.$emit('initialized')
    })
  }
}
</script>
