<template>
  <iframe width="100%" height="90%" src="/static/submission-form.html"></iframe>
</template>

<script>
export default {
  name: 'submission-form',
  mounted () {
    document.querySelector('.navbar-fixed').style.display = 'none'
    document.querySelectorAll('.tabs').forEach(e => { e.style.display = 'none' })
  }
}
</script>

<style>
iframe {
  width: 100%;
  height: 93vh;
  border: none;
}
</style>
