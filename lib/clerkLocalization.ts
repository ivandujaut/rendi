import { esES } from "@clerk/localizations";

/**
 * Localización de Clerk en castellano rioplatense (voseo), para que el widget
 * combine con el tono del resto de Rendi ("Iniciá", "Contanos", "tenés").
 * Extiende `esES` y solo pisa las claves que usan tuteo/usted en los textos
 * visibles del flujo (placeholders + links de sign-in / sign-up).
 */
export const esVos = {
  ...esES,
  formFieldInputPlaceholder__emailAddress: "Ingresá tu correo electrónico",
  formFieldInputPlaceholder__password: "Ingresá tu contraseña",
  formFieldInputPlaceholder__firstName: "Ingresá tu nombre",
  formFieldInputPlaceholder__lastName: "Ingresá tu apellido",
  signIn: {
    ...esES.signIn,
    start: {
      ...esES.signIn?.start,
      actionText: "¿No tenés cuenta?",
      actionLink: "Registrate",
    },
    password: {
      ...esES.signIn?.password,
      actionLink: "Usá otro método",
    },
  },
  signUp: {
    ...esES.signUp,
    start: {
      ...esES.signUp?.start,
      actionText: "¿Ya tenés cuenta?",
      actionLink: "Iniciá sesión",
    },
  },
};
