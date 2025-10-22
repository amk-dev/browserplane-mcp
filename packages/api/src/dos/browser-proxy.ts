export class BrowserProxy {
  private state: DurableObjectState
  private env: CloudflareBindings

  constructor(state: DurableObjectState, env: CloudflareBindings) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    return new Response('Hello from Durable Object!')
  }
}
