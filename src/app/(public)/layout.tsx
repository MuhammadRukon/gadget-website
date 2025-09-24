import { SectionContainer } from '../components/container/section-container';
import { Container } from '../components/container/container';
import { Footer } from '../components/footer/footer';
import { Header } from '../components/header/header';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <Container>
          <main>
            <SectionContainer>{children}</SectionContainer>
          </main>
        </Container>
        <Footer />
      </body>
    </html>
  );
}
