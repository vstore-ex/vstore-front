import './UserLink.css'
export default function UserLink({ id, children, className = '' }) {
  const valid = /^\d+$/.test(String(id)) && Number.isSafeInteger(Number(id)) && Number(id) > 0
  return valid ? <a className={'user-link ' + className} href={'#/users/' + encodeURIComponent(id)}>{children}</a>
    : <span className={className}>{children}</span>
}
