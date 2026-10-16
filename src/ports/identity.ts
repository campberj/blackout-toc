/** Local anonymous user (DESIGN §9). F5 maps this id to an account. */
export interface Identity {
  userId(): Promise<string>;
}
