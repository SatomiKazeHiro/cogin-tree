export default defineNuxtRouteMiddleware((to) => {
  const token = useCookie('skill-token');

  if (!token.value && to.path !== '/login' && to.path !== '/register') {
    return navigateTo('/login');
  }
});
