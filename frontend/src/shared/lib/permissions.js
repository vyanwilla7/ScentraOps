export function can(user, capability) {
  return Array.isArray(user?.permissions) && user.permissions.includes(capability);
}
