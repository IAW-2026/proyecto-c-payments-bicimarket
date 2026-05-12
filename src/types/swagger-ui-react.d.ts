declare module 'swagger-ui-react' {
  import * as React from 'react'
  export default function SwaggerUI(props: { url?: string; spec?: any }): React.JSX.Element
}
