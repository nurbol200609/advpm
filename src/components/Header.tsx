type HeaderProps = {
  title: string
}

function Header({ title }: HeaderProps) {
  return <h2>{title}</h2>
}

export default Header
