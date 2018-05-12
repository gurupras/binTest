<template>
  <li>
    <a class="silver app-option not-selectable"
        :class="[navigationDisabled ? 'disabled' : '', currentSection === target ? 'selected' : '']"
        @click="updateSection">
        {{ label }}
    </a>
  </li>
</template>

<script>
export default {
  name: 'app-section',
  props: {
    navigationDisabled: {
      type: Boolean,
      default: false
    },
    target: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    currentSection: {
      type: String
    }
  },
  data: function () {
    return {
    }
  },
  methods: {
    updateSection: function () {
      this.$emit('updateSection', this.target)
    }
  }
}
</script>

<style scoped>
.app-option {
  padding: 0 1em;
  margin: 0 0.1em;
  cursor: pointer;
}

.app-option.selected {
  color: #fff !important;
}
</style>
